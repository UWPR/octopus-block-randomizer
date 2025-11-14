import { SearchData, RandomizationConfig, RandomizationResult, RepeatedMeasuresGroup, RepeatedMeasuresQualityMetrics } from '../utils/types';
import { BlockType } from '../utils/types';
import { shuffleArray, getCovariateKey, groupByCovariates } from '../utils/utils';
import { createRepeatedMeasuresGroups, validateRepeatedMeasuresGroups } from './repeatedMeasuresGrouping';
import { distributeGroupsToPlates } from './repeatedMeasuresDistribution';

enum OverflowPrioritization {
  BY_CAPACITY = 'by_capacity',      // Prioritize higher capacity blocks (for plates)
  BY_GROUP_BALANCE = 'by_group_balance',  // Prioritize blocks with fewer samples of current group (for rows)
  NONE = 'none'                     // No prioritization - all available blocks considered equally
}


// Exported for testing purposes
export function distributeToBlocks(
  covariateGroups: Map<string, SearchData[]>,
  blockCapacities: number[],
  maxCapacity: number,
  selectedCovariates: string[],
  blockType: BlockType,
  expectedMinimums?: { [blockIdx: number]: { [groupKey: string]: number } }
): Map<number, SearchData[]> {
  const numBlocks = blockCapacities.length;
  const [blockAssignments, blockCounts] = initializeBlockAssignments(numBlocks);

  console.log(`Distributing samples across ${numBlocks} ${blockType.toLowerCase()} with capacities: ${blockCapacities.join(', ')}`);

  // PHASE 1: Place samples proportionately
  const [unplacedGroupsMap, remainingSamplesMap] = placeProportionalSamples(
    covariateGroups,
    blockCapacities,
    blockAssignments,
    blockCounts,
    maxCapacity,
    blockType,
    expectedMinimums
  );

  // Phase 2A: Process unplaced groups
  processUnplacedGroups(unplacedGroupsMap, blockCapacities, blockAssignments, blockCounts, blockType);

  // Phase 2B: Process overflow groups with appropriate prioritization strategy
  const prioritization = blockType === BlockType.PLATE ? OverflowPrioritization.BY_CAPACITY : OverflowPrioritization.BY_GROUP_BALANCE;
  processOverflowGroups(remainingSamplesMap, blockCapacities, blockAssignments, blockCounts, prioritization, selectedCovariates, blockType, maxCapacity);

  return blockAssignments;
}


// Helper function to initialize block assignments
function initializeBlockAssignments(numPlates: number): [Map<number, SearchData[]>, number[]] {
  const blockAssignments = new Map<number, SearchData[]>();
  const blockCounts = new Array(numPlates).fill(0);

  for (let i = 0; i < numPlates; i++) {
    blockAssignments.set(i, []);
  }

  return [blockAssignments, blockCounts];
}

// Helper function to get available blocks/plates with capacity
function getAvailableBlocks(
  numBlocks: number,
  blockCapacities: number[],
  blockCounts: number[]
): number[] {
  const availableBlocks = [];
  for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
    const availableCapacity = blockCapacities[blockIdx] - blockCounts[blockIdx];
    if (availableCapacity > 0) {
      // console.log(`  Block is available. Index: ${blockIdx}; Capacity: ${availableCapacity}`);
      availableBlocks.push(blockIdx);
    }
  }
  return availableBlocks;
}

// Helper function to calculate expected minimum samples per block (plates or rows) for each covariate group
// Throws an error if the total samples exceed available capacity or if any block's expected minimums exceed its capacity
//
// Exported for testing purposes
export function calculateExpectedMinimums(
  blockCapacities: number[],
  covariateGroups: Map<string, SearchData[]>,
  fullBlockCapacity: number,
  blockType: BlockType
): { [blockIdx: number]: { [groupKey: string]: number } } {

  const expectedMinimums: { [blockIdx: number]: { [groupKey: string]: number } } = {};
  const totalBlocksNeeded = blockCapacities.length;

  // Calculate total samples across all groups
  let totalSamples = 0;
  covariateGroups.forEach((samples) => {
    totalSamples += samples.length;
  });

  // Calculate total available capacity
  const totalCapacity = blockCapacities.reduce((sum, capacity) => sum + capacity, 0);

  // Validate that total samples don't exceed total capacity
  if (totalSamples > totalCapacity) {
    throw new Error(
      `Cannot distribute ${totalSamples} samples across ${blockType.toLowerCase()}s with total capacity ${totalCapacity}. ` +
      `Total samples exceed available capacity by ${totalSamples - totalCapacity}.`
    );
  }

  console.log(`Calculating expected minimums per ${blockType} based on capacities:`);
  blockCapacities.forEach((capacity, blockIdx) => {
    expectedMinimums[blockIdx] = {};
    let blockTotalExpected = 0;

    covariateGroups.forEach((samples, groupKey) => {
      // Calculate expected minimum for this covariate group on this specific block
      // Based on the block's capacity relative to a full block
      const capacityRatio = totalBlocksNeeded == 1 ? 1 : capacity / fullBlockCapacity;
      const globalExpected = Math.floor(samples.length / totalBlocksNeeded);

      expectedMinimums[blockIdx][groupKey] = Math.round(globalExpected * capacityRatio);
      blockTotalExpected += expectedMinimums[blockIdx][groupKey];

      console.log(`  ${blockType} ${blockIdx + 1},  Group ${groupKey}, Samples ${samples.length}, Expected ${globalExpected},
          Capacity ratio: ${capacityRatio.toFixed(2)}, Expected minimum: ${expectedMinimums[blockIdx][groupKey]}`);
    });

    // Validate that expected minimums for this block don't exceed its capacity
    if (blockTotalExpected > capacity) {
      throw new Error(
        `${blockType} ${blockIdx + 1} expected minimums (${blockTotalExpected}) exceed its capacity (${capacity}). ` +
        `This indicates an impossible distribution scenario.`
      );
    }
  });

  return expectedMinimums;
}

// Helper function to assign block capacities based on distribution strategy
// Exported for testing purposes
export function assignBlockCapacities(
  totalSamples: number,
  actualBlocksNeeded: number,
  keepEmptyInLastBlock: boolean,
  blockSize: number,
  blockName: BlockType
): number[] {

  if (totalSamples === 0) {
    return [0];
  }

  if (totalSamples > actualBlocksNeeded * blockSize) {
    console.error(`Total samples (${totalSamples}) exceed total block capacity (${actualBlocksNeeded * blockSize}).`);
    return [0];
  }

  let blockCapacities: number[];

  if (keepEmptyInLastBlock) {
    // Calculate how many blocks should be completely filled
    const fullBlocks = Math.floor(totalSamples / blockSize);
    const remainingSamples = totalSamples % blockSize;
    console.log(`Calculating ${blockName} capacities with keepEmptyInLastBlock=true: ${totalSamples} samples, ${fullBlocks} full ${blockName}s, ${remainingSamples} remaining samples`);

    // Set capacities: full blocks get blockSize, last block gets remaining samples
    blockCapacities = Array(fullBlocks).fill(blockSize);
    if (remainingSamples > 0) {
      blockCapacities.push(remainingSamples);
    }

    console.log(`Keep empty in last ${blockName}: ${totalSamples} samples across ${blockCapacities.length} ${blockName}s with capacities: ${blockCapacities.join(', ')}`);
  } else {

    // Distribute empty spots randomly across all blocks
    const baseSamplesPerBlock = Math.floor(totalSamples / actualBlocksNeeded);
    const extraSamples = totalSamples % actualBlocksNeeded;
    console.log(`Calculating ${blockName} capacities with keepEmptyInLastBlock=false: ${totalSamples} samples, ${actualBlocksNeeded} ${blockName}s, base samples per ${blockName}: ${baseSamplesPerBlock}, extra samples: ${extraSamples}`);

    blockCapacities = Array(actualBlocksNeeded).fill(baseSamplesPerBlock);

    // Randomly assign extra samples to blocks instead of always using the first ones
    const blockIndices = Array.from({ length: actualBlocksNeeded }, (_, i) => i);
    const shuffledIndices = shuffleArray(blockIndices);

    for (let i = 0; i < extraSamples; i++) {
      blockCapacities[shuffledIndices[i]]++;
    }

    console.log(`Random distribution of empty spots: ${totalSamples} samples across ${actualBlocksNeeded} ${blockName}s with capacities: ${blockCapacities.join(', ')}`);
  }

  return blockCapacities;
}

// Helper function to validate capacity
function validateCapacity(totalSamples: number, plateCapacities: number[]): boolean {
  const totalCapacity = plateCapacities.reduce((sum, capacity) => sum + capacity, 0);
  console.log(`Plate capacities: ${plateCapacities.join(', ')}; Sample count: ${totalSamples}`);

  if (totalSamples > totalCapacity) {
    console.error(`Not enough capacity: ${totalSamples} samples > ${totalCapacity} total capacity`);
    return false;
  }
  return true;
}

// Helper function for Phase 1 proportional placement
function placeProportionalSamples(
  covariateGroups: Map<string, SearchData[]>,
  plateCapacities: number[],
  blockAssignments: Map<number, SearchData[]>,
  blockCounts: number[],
  maxCapacity: number = 96,
  blockType: BlockType,
  expectedMinimums?: { [blockIdx: number]: { [groupKey: string]: number } }
): [Map<string, SearchData[]>, Map<string, SearchData[]>] {
  const numPlates = plateCapacities.length;
  const unplacedGroupsMap = new Map<string, SearchData[]>();
  const overflowSamplesMap = new Map<string, SearchData[]>();

  covariateGroups.forEach((samples, groupKey) => {
    const shuffledSamples = shuffleArray([...samples]);
    const totalGroupSamples = shuffledSamples.length;
    const baseSamplesPerPlate = Math.floor(totalGroupSamples / numPlates);

    let sampleIndex = 0;
    console.log(`Phase 1 (${blockType}): Minimum required samples / plate for group ${groupKey} (${totalGroupSamples}/${numPlates}): ${baseSamplesPerPlate}`);

    // Place samples proportionally in all plates based on capacity ratio or expected minimums
    if (baseSamplesPerPlate > 0) {
      for (let plateIdx = 0; plateIdx < numPlates; plateIdx++) {
        let proportionalSamples: number;
        let logMessage: string;

        if (expectedMinimums && expectedMinimums[plateIdx] && expectedMinimums[plateIdx][groupKey] !== undefined) {
          // Use pre-calculated expected minimum
          proportionalSamples = expectedMinimums[plateIdx][groupKey];
          logMessage = `  Placing proportional samples in ${blockType.toLowerCase()} index ${plateIdx}: ${proportionalSamples} (from expected minimums)`;
        } else {
          // Fall back to capacity ratio calculation
          const capacityRatio = plateCapacities[plateIdx] / maxCapacity;
          proportionalSamples = Math.round(baseSamplesPerPlate * capacityRatio);
          logMessage = `  Placing proportional samples in ${blockType.toLowerCase()} index ${plateIdx}: ${proportionalSamples} (capacity ratio: ${capacityRatio.toFixed(2)})`;
        }

        console.log(logMessage);

        const availableCapacity = plateCapacities[plateIdx] - blockCounts[plateIdx];
        const samplesToPlace = Math.min(proportionalSamples, availableCapacity);

        if (samplesToPlace < proportionalSamples) {
          console.error(`Phase 1 (${blockType}): ${blockType.slice(0, -1)} ${plateIdx} cannot accommodate proportional ${proportionalSamples} samples for group ${groupKey}. Only ${samplesToPlace} can be placed.`);
        }

        for (let i = 0; i < samplesToPlace && sampleIndex < shuffledSamples.length; i++) {
          blockAssignments.get(plateIdx)!.push(shuffledSamples[sampleIndex++]);
          blockCounts[plateIdx]++;
        }
      }
    }

    // Store remaining samples for Phase 2
    if (sampleIndex < shuffledSamples.length) {
      const remainingSamples = shuffledSamples.slice(sampleIndex);
      if (baseSamplesPerPlate === 0) {
        unplacedGroupsMap.set(groupKey, remainingSamples);
      } else {
        overflowSamplesMap.set(groupKey, remainingSamples);
      }
    }
  });

  return [unplacedGroupsMap, overflowSamplesMap];
}

// Helper function to distribute samples across available blocks
function distributeSamplesAcrossBlocks(
  remainingSamples: SearchData[],
  availableBlocks: number[],
  blockCapacities: number[],
  blockAssignments: Map<number, SearchData[]>,
  blockCounts: number[],
  logPrefix: string,
  preserveOrder: boolean = false
): number {
  const blocksToUse = preserveOrder ? [...availableBlocks] : shuffleArray([...availableBlocks]);
  let sampleIndex = 0;
  let blockIndex = 0;

  while (sampleIndex < remainingSamples.length && blocksToUse.length > 0) {
    const blockIdx = blocksToUse[blockIndex % blocksToUse.length];

    if (blockCounts[blockIdx] < blockCapacities[blockIdx]) {
      console.log(`  ${logPrefix} sample in block index: ${blockIdx}`);
      blockAssignments.get(blockIdx)!.push(remainingSamples[sampleIndex]);
      blockCounts[blockIdx]++;
      sampleIndex++;
    } else {
      blocksToUse.splice(blockIndex % blocksToUse.length, 1);
      if (blocksToUse.length === 0) break;
      blockIndex = blockIndex % blocksToUse.length;
      continue;
    }

    blockIndex++;
  }

  return sampleIndex;
}

// Helper function for Phase 2A - unplaced groups
function processUnplacedGroups(
  unplacedGroupsMap: Map<string, SearchData[]>,
  blockCapacities: number[],
  blockAssignments: Map<number, SearchData[]>,
  blockCounts: number[],
  blockType: BlockType
): void {
  const numBlocks = blockCapacities.length;
  const sortedUnplacedGroups = Array.from(unplacedGroupsMap.entries())
    .sort(([, samplesA], [, samplesB]) => samplesB.length - samplesA.length);

  sortedUnplacedGroups.forEach(([groupKey, remainingSamples]) => {
    console.log(`Phase 2A (${blockType}): Unplaced group ${groupKey}: ${remainingSamples.length} samples`);

    const availableBlocks = getAvailableBlocks(numBlocks, blockCapacities, blockCounts);

    if (availableBlocks.length === 0) {
      console.error(`Phase 2A (${blockType}): No available capacity for unplaced group ${groupKey}`);
      return;
    }

    // Sort available blocks by available capacity descending (most space first)
    const sortedAvailableBlocks = availableBlocks.sort((a, b) => {
      const availableCapacityA = blockCapacities[a] - blockCounts[a];
      const availableCapacityB = blockCapacities[b] - blockCounts[b];
      return availableCapacityB - availableCapacityA; // Descending order
    });

    const placedSamples = distributeSamplesAcrossBlocks(
      remainingSamples,
      sortedAvailableBlocks,
      blockCapacities,
      blockAssignments,
      blockCounts,
      `Placing 1 unplaced (${blockType})`,
      true // Use sorted order
    );

    if (placedSamples < remainingSamples.length) {
      console.error(`Phase 2A (${blockType}): Failed to place ${remainingSamples.length - placedSamples} unplaced samples from group ${groupKey}`);
    }
  });
}

// Helper function for Phase 2B - overflow groups
function processOverflowGroups(
  overflowSamplesMap: Map<string, SearchData[]>,
  plateCapacities: number[],
  blockAssignments: Map<number, SearchData[]>,
  blockCounts: number[],
  prioritization: OverflowPrioritization,
  selectedCovariates: string[] = [],
  blockType: BlockType,
  fullCapacity: number = 96
): void {
  const numPlates = plateCapacities.length;
  const sortedOverflowGroups = Array.from(overflowSamplesMap.entries())
    .sort(([, samplesA], [, samplesB]) => samplesB.length - samplesA.length);

  sortedOverflowGroups.forEach(([groupKey, remainingSamples]) => {
    console.log(`Phase 2B (${blockType}): Overflow group ${groupKey}: ${remainingSamples.length} samples`);

    const availableBlocks = getAvailableBlocks(numPlates, plateCapacities, blockCounts);

    if (availableBlocks.length === 0) {
      console.error(`Phase 2B (${blockType}): No available capacity for overflow group ${groupKey}`);
      return;
    }

    let prioritizedBlocks: number[];

    if (prioritization === OverflowPrioritization.BY_CAPACITY) {
      // Prioritize higher capacity blocks (for plate-level distribution)
      const fullCapacityBlocks: number[] = [];
      const partialCapacityBlocks: number[] = [];

      availableBlocks.forEach(blockIdx => {
        if (plateCapacities[blockIdx] === fullCapacity) {
          fullCapacityBlocks.push(blockIdx);
        } else {
          partialCapacityBlocks.push(blockIdx);
        }
      });

      const shuffledFullBlocks = shuffleArray([...fullCapacityBlocks]);
      const shuffledPartialBlocks = shuffleArray([...partialCapacityBlocks]);
      prioritizedBlocks = [...shuffledFullBlocks, ...shuffledPartialBlocks];
    } else if (prioritization === OverflowPrioritization.BY_GROUP_BALANCE) {
      // Prioritize blocks with fewer samples of this covariate group (for row-level distribution)
      const blockGroupCounts = availableBlocks.map(blockIdx => {
        const blockSamples = blockAssignments.get(blockIdx) || [];
        const groupCount = blockSamples.filter(sample =>
          getCovariateKey(sample, selectedCovariates) === groupKey
        ).length;
        return { blockIdx, groupCount };
      });

      // Sort by group count (ascending) to prioritize blocks with fewer samples of this group
      blockGroupCounts.sort((a, b) => a.groupCount - b.groupCount);
      prioritizedBlocks = blockGroupCounts.map(item => item.blockIdx);
    } else {
      // No prioritization - shuffle all available blocks equally
      prioritizedBlocks = shuffleArray([...availableBlocks]);
    }

    const placedSamples = distributeSamplesAcrossBlocks(
      remainingSamples,
      prioritizedBlocks,
      plateCapacities,
      blockAssignments,
      blockCounts,
      `Placing 1 overflow (${blockType})`,
      true // Preserve priority order
    );

    if (placedSamples < remainingSamples.length) {
      console.error(`Phase 2B (${blockType}): Failed to place ${remainingSamples.length - placedSamples} overflow samples from group ${groupKey}`);
    }
  });
}



// Validation function for per-block distribution (plates or rows)
function validatePerBlockDistribution(
  blockAssignments: Map<number, SearchData[]>,
  selectedCovariates: string[],
  expectedMinimumsPerBlock: { [blockIdx: number]: { [groupKey: string]: number } },
  blockTypeName: BlockType
): boolean {
  let isValid = true;

  blockAssignments.forEach((samples, blockIdx) => {
    const groupCounts = new Map<string, number>();

    // Count samples by group in this block
    samples.forEach(sample => {
      const groupKey = getCovariateKey(sample, selectedCovariates);
      groupCounts.set(groupKey, (groupCounts.get(groupKey) || 0) + 1);
    });

    const blockExpectedMinimums = expectedMinimumsPerBlock[blockIdx] || {};

    // Check if each group meets minimum requirements
    Object.entries(blockExpectedMinimums).forEach(([groupKey, minCount]) => {
      const actualCount = groupCounts.get(groupKey) || 0;
      if (actualCount < minCount) {
        console.error(`Validation: ${blockTypeName} ${blockIdx} has only ${actualCount} samples for group ${groupKey}, expected minimum ${minCount}`);
        isValid = false;
      }
    });
  });

  return isValid;
}


// Balanced randomization (proportional distribution in plates and rows + row shuffling)
// Overload 1: New signature with RandomizationConfig
export function balancedBlockRandomization(
  searches: SearchData[],
  config: RandomizationConfig
): RandomizationResult;

// Overload 2: Legacy signature for backward compatibility
export function balancedBlockRandomization(
  searches: SearchData[],
  selectedCovariates: string[],
  keepEmptyInLastPlate?: boolean,
  numRows?: number,
  numColumns?: number
): {
  plates: (SearchData | undefined)[][][];
  plateAssignments?: Map<number, SearchData[]>;
};

// Implementation
export function balancedBlockRandomization(
  searches: SearchData[],
  configOrCovariates: RandomizationConfig | string[],
  keepEmptyInLastPlate: boolean = true,
  numRows: number = 8,
  numColumns: number = 12
): RandomizationResult | {
  plates: (SearchData | undefined)[][][];
  plateAssignments?: Map<number, SearchData[]>;
} {
  // Determine if we're using the new config-based signature or legacy signature
  if (Array.isArray(configOrCovariates)) {
    // Legacy signature: (searches, selectedCovariates, keepEmptyInLastPlate, numRows, numColumns)
    return doStandardRandomization(searches, configOrCovariates, keepEmptyInLastPlate, numRows, numColumns);
  } else {
    // New signature: (searches, config)
    const config = configOrCovariates;

    // Route to appropriate algorithm based on whether repeated-measures variable is set
    if (config.repeatedMeasuresVariable) {
      // Use repeated-measures-aware randomization
      return doRepeatedMeasuresAwareRandomization(searches, config);
    } else {
      // Use standard randomization
      return doStandardRandomization(
        searches,
        config.treatmentVariables,
        config.keepEmptyInLastPlate,
        config.numRows,
        config.numColumns
      );
    }
  }
}

/**
 * Calculates comprehensive quality metrics for repeated-measures randomization.
 *
 * This function evaluates the quality of a repeated-measures randomization by calculating
 * both repeated-measures-specific metrics (constraint satisfaction, group distribution) and
 * standard quality metrics (treatment balance, row clustering). It provides a comprehensive
 * assessment of randomization quality for reporting and validation.
 *
 * **Metrics Calculated:**
 *
 * 1. **Repeated-Measures Constraint Satisfaction:**
 *    - Validates that no groups are split across plates
 *    - Counts any violations (should be 0)
 *    - Tracks unique subject IDs and their plate assignments
 *
 * 2. **Treatment Balance Score:**
 *    - Uses standard balance calculation from quality metrics
 *    - Measures how well treatment proportions match across plates
 *    - Score of 100 = perfect balance, lower = more imbalance
 *
 * 3. **Per-Plate Group Counts:**
 *    - Counts how many groups are assigned to each plate
 *    - Includes both multi-sample groups and singletons
 *    - Useful for assessing distribution evenness
 *
 * 4. **Group Size Distribution:**
 *    - Categorizes groups by size: singletons, small (2-5), medium (6-15), large (16+)
 *    - Provides overview of group composition
 *    - Helps identify potential balancing challenges
 *
 * 5. **Standard Quality Metrics:**
 *    - Treatment balance across plates
 *    - Row clustering scores
 *    - Overall quality assessment
 *
 * **Example Usage:**
 * ```typescript
 * const metrics = calculateRepeatedMeasuresQualityMetrics(
 *   samples,
 *   groups,
 *   plateAssignments,
 *   plates,
 *   ['Treatment', 'Timepoint'],
 *   'PatientID'
 * );
 *
 * console.log(`Constraints satisfied: ${metrics.repeatedMeasuresConstraintsSatisfied}`);
 * console.log(`Balance score: ${metrics.treatmentBalanceScore}/100`);
 * console.log(`Total groups: ${metrics.groupSizeDistribution.singletons +
 *                              metrics.groupSizeDistribution.small +
 *                              metrics.groupSizeDistribution.medium +
 *                              metrics.groupSizeDistribution.large}`);
 * ```
 *
 * **Constraint Validation Logic:**
 * - Tracks which plate each subject ID is assigned to
 * - If same subject ID appears on multiple plates, counts as violation
 * - Singletons (no subject ID) are skipped in validation
 * - Any violations indicate a critical error in the algorithm
 *
 * **Group Size Categories:**
 * - **Singletons:** Groups with isSingleton = true (samples without subject ID)
 * - **Small:** 2-5 samples (typical for most repeated-measures designs)
 * - **Medium:** 6-15 samples (larger longitudinal studies)
 * - **Large:** 16+ samples (extensive time series or technical replicates)
 *
 * **Edge Cases:**
 * - No groups: Returns metrics with all counts at 0
 * - All singletons: High singleton count, no multi-sample groups
 * - Single plate: Balance score may be perfect (no cross-plate comparison)
 * - Violations detected: Sets repeatedMeasuresConstraintsSatisfied to false
 *
 * **Limitations:**
 * - Does not calculate spatial clustering metrics
 * - Does not assess batch effect mitigation
 * - Group size categories are fixed (not configurable)
 * - Does not provide per-treatment balance scores
 *
 * @param searches - All samples that were randomized. Used for standard quality metrics calculation.
 * @param groups - Array of repeated-measures groups created during randomization. Used for group size distribution.
 * @param plateAssignments - Map of plate index to samples assigned to that plate. Used for constraint validation.
 * @param plates - 3D array representing the final plate layout [plate][row][col]. Used for standard quality metrics.
 * @param treatmentVariables - Array of treatment variable names used for balancing. Used for standard quality metrics.
 * @param repeatedMeasuresVariable - Variable name used for grouping (e.g., "PatientID"). Used for constraint validation.
 * @returns RepeatedMeasuresQualityMetrics object containing:
 *          - repeatedMeasuresConstraintsSatisfied: Boolean indicating if all groups stayed together
 *          - repeatedMeasuresViolations: Count of groups split across plates (should be 0)
 *          - treatmentBalanceScore: Overall balance score (0-100, higher is better)
 *          - plateGroupCounts: Array of group counts per plate
 *          - groupSizeDistribution: Object with counts for each size category
 *          - standardMetrics: Full standard quality metrics object
 *
 * @see {@link validateRepeatedMeasuresConstraints} for constraint validation details
 * @see {@link calculateQualityMetrics} from utils/qualityMetrics for standard metrics
 */
function calculateRepeatedMeasuresQualityMetrics(
  searches: SearchData[],
  groups: RepeatedMeasuresGroup[],
  plateAssignments: Map<number, SearchData[]>,
  plates: (SearchData | undefined)[][][],
  treatmentVariables: string[],
  repeatedMeasuresVariable: string
): RepeatedMeasuresQualityMetrics {
  console.log(`\nCalculating quality metrics for repeated-measures randomization...`);

  // Import quality metrics calculation
  const { calculateQualityMetrics } = require('../utils/qualityMetrics');

  // Calculate standard quality metrics
  console.log(`  - Calculating standard quality metrics (balance and row clustering)...`);
  const standardMetrics = calculateQualityMetrics(
    searches,
    plateAssignments,
    plates,
    treatmentVariables
  );

  // Check if repeated-measures constraints are satisfied
  console.log(`  - Validating repeated-measures constraint satisfaction...`);
  let repeatedMeasuresConstraintsSatisfied = true;
  let repeatedMeasuresViolations = 0;

  // Track which plate each subject ID is assigned to
  const subjectIdToPlate = new Map<string, number>();

  plateAssignments.forEach((samples, plateIdx) => {
    samples.forEach(sample => {
      const subjectId = sample.metadata[repeatedMeasuresVariable];

      if (!subjectId || subjectId === '') {
        return; // Skip singletons
      }

      if (subjectIdToPlate.has(subjectId)) {
        const previousPlateIdx = subjectIdToPlate.get(subjectId)!;
        if (previousPlateIdx !== plateIdx) {
          repeatedMeasuresConstraintsSatisfied = false;
          repeatedMeasuresViolations++;
        }
      } else {
        subjectIdToPlate.set(subjectId, plateIdx);
      }
    });
  });

  // Calculate treatment balance score
  const treatmentBalanceScore = standardMetrics.plateDiversity.averageBalanceScore;

  // Calculate per-plate group counts
  console.log(`  - Calculating per-plate group counts...`);
  const plateGroupCounts: number[] = [];
  plateAssignments.forEach((samples, plateIdx) => {
    const plateSubjectIds = new Set<string>();
    samples.forEach(sample => {
      const subjectId = sample.metadata[repeatedMeasuresVariable];
      if (subjectId && subjectId !== '') {
        plateSubjectIds.add(subjectId);
      } else {
        // Each singleton counts as its own group
        plateSubjectIds.add(`singleton_${sample.name}`);
      }
    });
    plateGroupCounts.push(plateSubjectIds.size);
    console.log(`    Plate ${plateIdx + 1}: ${plateSubjectIds.size} groups, ${samples.length} samples`);
  });

  // Calculate group size distribution
  console.log(`  - Calculating group size distribution...`);
  const groupSizeDistribution = {
    singletons: 0,
    small: 0,    // 2-5 samples
    medium: 0,   // 6-15 samples
    large: 0     // 16+ samples
  };

  groups.forEach(group => {
    if (group.isSingleton) {
      groupSizeDistribution.singletons++;
    } else if (group.size <= 5) {
      groupSizeDistribution.small++;
    } else if (group.size <= 15) {
      groupSizeDistribution.medium++;
    } else {
      groupSizeDistribution.large++;
    }
  });

  // Log comprehensive quality metrics summary
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│           QUALITY METRICS SUMMARY                           │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  console.log(`\nRepeated-Measures Constraints:`);
  console.log(`  ✓ Constraints satisfied: ${repeatedMeasuresConstraintsSatisfied ? 'YES' : 'NO'}`);
  console.log(`  ✓ Violations detected: ${repeatedMeasuresViolations}`);
  console.log(`  ✓ Unique subject IDs tracked: ${subjectIdToPlate.size}`);

  console.log(`\nTreatment Balance:`);
  console.log(`  ✓ Overall balance score: ${treatmentBalanceScore.toFixed(2)}/100`);
  console.log(`  ✓ Quality level: ${standardMetrics.overallQuality.level}`);

  console.log(`\nGroup Size Distribution:`);
  console.log(`  ✓ Singletons: ${groupSizeDistribution.singletons} groups`);
  console.log(`  ✓ Small (2-5 samples): ${groupSizeDistribution.small} groups`);
  console.log(`  ✓ Medium (6-15 samples): ${groupSizeDistribution.medium} groups`);
  console.log(`  ✓ Large (16+ samples): ${groupSizeDistribution.large} groups`);
  console.log(`  ✓ Total groups: ${groups.length}`);

  console.log(`\nPer-Plate Group Distribution:`);
  plateGroupCounts.forEach((count, idx) => {
    const samples = plateAssignments.get(idx)?.length || 0;
    const avgGroupSize = samples > 0 ? (samples / count).toFixed(1) : '0';
    console.log(`  ✓ Plate ${idx + 1}: ${count} groups (avg size: ${avgGroupSize} samples)`);
  });

  console.log(`\nStandard Quality Metrics:`);
  console.log(`  ✓ Average balance score: ${standardMetrics.plateDiversity.averageBalanceScore.toFixed(2)}/100`);
  console.log(`  ✓ Average row clustering score: ${standardMetrics.plateDiversity.averageRowClusteringScore.toFixed(2)}/100`);
  console.log(`  ✓ Overall quality score: ${standardMetrics.overallQuality.score.toFixed(2)}/100`);

  return {
    repeatedMeasuresConstraintsSatisfied,
    repeatedMeasuresViolations,
    treatmentBalanceScore,
    plateGroupCounts,
    groupSizeDistribution,
    standardMetrics
  };
}

/**
 * Performs repeated-measures-aware randomization with constraint satisfaction.
 *
 * This function implements the complete repeated-measures randomization algorithm that ensures
 * samples from the same subject (sharing the same repeated-measures variable value) are assigned
 * to the same plate while maintaining approximate treatment balance across plates. It extends
 * the standard randomization algorithm with group-based distribution at the plate level.
 *
 * **Algorithm Overview:**
 *
 * 1. **Group Creation:** Create repeated-measures groups from samples based on shared identifier
 * 2. **Validation:** Check for oversized groups and other issues that would prevent distribution
 * 3. **Capacity Calculation:** Determine how many plates are needed and their capacities
 * 4. **Group Distribution:** Assign groups to plates using balanced best-fit algorithm
 * 5. **Flattening:** Convert group assignments back to individual sample assignments
 * 6. **Row Distribution:** Apply standard row-level distribution within each plate
 * 7. **Constraint Validation:** Verify no groups were split across plates
 * 8. **Quality Metrics:** Calculate comprehensive quality metrics for reporting
 *
 * **Key Differences from Standard Randomization:**
 * - Operates on groups at plate level (not individual samples)
 * - Uses balanced best-fit algorithm for plate distribution (not proportional distribution)
 * - Validates repeated-measures constraints after distribution
 * - Returns additional metadata (groups, quality metrics)
 * - May achieve less perfect balance due to group atomicity constraints
 *
 * **Example Usage:**
 * ```typescript
 * const config: RandomizationConfig = {
 *   treatmentVariables: ['Treatment', 'Timepoint'],
 *   repeatedMeasuresVariable: 'PatientID',
 *   keepEmptyInLastPlate: true,
 *   numRows: 8,
 *   numColumns: 12
 * };
 *
 * const result = doRepeatedMeasuresAwareRandomization(samples, config);
 *
 * console.log(`Created ${result.repeatedMeasuresGroups.length} groups`);
 * console.log(`Distributed across ${result.plates.length} plates`);
 * console.log(`Constraints satisfied: ${result.qualityMetrics.repeatedMeasuresConstraintsSatisfied}`);
 * ```
 *
 * **Plate-Level Distribution:**
 * - Groups are assigned to plates using balanced best-fit algorithm
 * - Each group is assigned to the plate that minimizes treatment imbalance
 * - Groups are never split across plates (atomic assignment)
 * - Capacity constraints are strictly enforced
 *
 * **Row-Level Distribution:**
 * - After plate assignment, samples within each plate are distributed to rows
 * - Uses standard proportional distribution algorithm
 * - Maintains treatment balance at row level within each plate
 * - Samples are shuffled within rows for final randomization
 *
 * **Validation and Error Handling:**
 * - Throws error if any group exceeds plate capacity (oversized group)
 * - Throws error if group cannot fit in any available plate
 * - Throws error if repeated-measures constraints are violated after distribution
 * - Logs warnings for large groups or high singleton ratios
 *
 * **Edge Cases:**
 * - All samples have same subject ID: Single group assigned to one plate
 * - No samples have subject ID: All singletons, behaves like standard randomization
 * - Mixed groups and singletons: Handles both correctly
 * - Single plate: All groups assigned to that plate
 * - Partial last plate: Capacity calculated based on keepEmptyInLastPlate setting
 *
 * **Limitations:**
 * - Balance may be less perfect than standard randomization due to group constraints
 * - Large groups can significantly limit balancing flexibility
 * - Does not perform post-distribution optimization (e.g., group swapping)
 * - Assumes all groups must be assigned (no optional groups)
 * - Does not consider spatial or batch constraints beyond plate boundaries
 *
 * @param searches - All samples to randomize. Each sample must have metadata with repeated-measures variable.
 * @param config - Configuration object containing:
 *                 - treatmentVariables: Variables to balance across plates
 *                 - repeatedMeasuresVariable: Variable used for grouping (e.g., "PatientID")
 *                 - keepEmptyInLastPlate: Whether to keep empty cells in last plate
 *                 - numRows: Number of rows per plate
 *                 - numColumns: Number of columns per plate
 * @returns RandomizationResult object containing:
 *          - plates: 3D array [plate][row][col] with sample assignments
 *          - plateAssignments: Map of plate index to samples
 *          - repeatedMeasuresGroups: Array of groups created
 *          - qualityMetrics: Comprehensive quality metrics
 *
 * @throws {Error} If repeated-measures variable is not provided in config
 * @throws {Error} If any group exceeds plate capacity (oversized group)
 * @throws {Error} If any group cannot fit in any available plate
 * @throws {Error} If repeated-measures constraints are violated after distribution
 *
 * @see {@link createRepeatedMeasuresGroups} for group creation
 * @see {@link validateRepeatedMeasuresGroups} for validation
 * @see {@link distributeGroupsToPlates} for plate distribution
 * @see {@link validateRepeatedMeasuresConstraints} for constraint validation
 * @see {@link calculateRepeatedMeasuresQualityMetrics} for quality metrics
 */
function doRepeatedMeasuresAwareRandomization(
  searches: SearchData[],
  config: RandomizationConfig
): RandomizationResult {
  const {
    treatmentVariables,
    repeatedMeasuresVariable,
    keepEmptyInLastPlate,
    numRows,
    numColumns
  } = config;

  if (!repeatedMeasuresVariable) {
    throw new Error('repeatedMeasuresVariable is required for repeated-measures-aware randomization');
  }

  const totalSamples = searches.length;
  const plateSize = numRows * numColumns;

  console.log(`\n=== Starting Repeated-Measures-Aware Randomization ===`);
  console.log(`Total samples: ${totalSamples}`);
  console.log(`Plate size: ${plateSize} (${numRows} rows × ${numColumns} columns)`);
  console.log(`Treatment variables: ${treatmentVariables.join(', ')}`);
  console.log(`Repeated-measures variable: ${repeatedMeasuresVariable}`);

  // Step 1: Create repeated-measures groups
  console.log(`\n--- Step 1: Creating repeated-measures groups ---`);
  const groups = createRepeatedMeasuresGroups(
    searches,
    repeatedMeasuresVariable,
    treatmentVariables
  );

  // Step 2: Validate groups
  console.log(`\n--- Step 2: Validating repeated-measures groups ---`);
  const validation = validateRepeatedMeasuresGroups(groups, plateSize);

  if (!validation.isValid) {
    // Throw error with all validation errors
    throw new Error(
      `Repeated-measures group validation failed:\n${validation.errors.join('\n')}`
    );
  }

  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn('Validation warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // Step 3: Calculate plate capacities
  console.log(`\n--- Step 3: Calculating plate capacities ---`);
  const actualPlatesNeeded = Math.ceil(totalSamples / plateSize);
  const plateCapacities = assignBlockCapacities(
    totalSamples,
    actualPlatesNeeded,
    keepEmptyInLastPlate,
    plateSize,
    BlockType.PLATE
  );

  console.log(`Plates needed: ${actualPlatesNeeded}`);
  console.log(`Plate capacities: ${plateCapacities.join(', ')}`);

  // Step 4: Distribute groups to plates
  console.log(`\n--- Step 4: Distributing groups to plates ---`);
  const plateGroupAssignments = distributeGroupsToPlates(
    groups,
    plateCapacities,
    treatmentVariables
  );

  // Step 5: Flatten groups back to samples
  console.log(`\n--- Step 5: Flattening groups to samples ---`);
  const plateAssignments = new Map<number, SearchData[]>();

  plateGroupAssignments.forEach((assignedGroups, plateIdx) => {
    const plateSamples: SearchData[] = [];

    assignedGroups.forEach(group => {
      plateSamples.push(...group.samples);
    });

    plateAssignments.set(plateIdx, plateSamples);

    console.log(
      `Plate ${plateIdx + 1}: ${assignedGroups.length} groups → ${plateSamples.length} samples`
    );
  });

  // Step 6: Apply existing row distribution to each plate
  console.log(`\n--- Step 6: Applying row distribution within each plate ---`);

  // Initialize plates array
  const plates = Array.from({ length: actualPlatesNeeded }, () =>
    Array.from({ length: numRows }, () => new Array(numColumns).fill(undefined))
  );

  plateAssignments.forEach((plateSamples, plateIdx) => {
    console.log(`\nProcessing plate ${plateIdx + 1} with ${plateSamples.length} samples`);

    // Shuffle plate samples before grouping to add initial randomization
    const shuffledPlateSamples = shuffleArray([...plateSamples]);

    // Group samples by treatment covariates for this plate
    const plateGroups = groupByCovariates(shuffledPlateSamples, treatmentVariables);

    // Calculate how many rows we need
    const totalPlateSamples = plateSamples.length;
    const rowsNeeded = Math.ceil(totalPlateSamples / numColumns);
    const actualRowsToUse = Math.min(rowsNeeded, numRows);

    console.log(`  Rows needed: ${rowsNeeded}, using: ${actualRowsToUse}`);

    // Calculate row capacities (fill rows sequentially, leaving empty cells in last row)
    const rowCapacities = assignBlockCapacities(
      totalPlateSamples,
      actualRowsToUse,
      true, // Always keep empty in last row
      numColumns,
      BlockType.ROW
    );

    // Calculate expected minimums per row
    const expectedRowMinimums = calculateExpectedMinimums(
      rowCapacities,
      plateGroups,
      numColumns,
      BlockType.ROW
    );

    // Distribute samples to rows
    const rowAssignments = distributeToBlocks(
      plateGroups,
      rowCapacities,
      numColumns,
      treatmentVariables,
      BlockType.ROW,
      expectedRowMinimums
    );

    // Validate row-level distribution
    const rowDistributionValid = validatePerBlockDistribution(
      rowAssignments,
      treatmentVariables,
      expectedRowMinimums,
      BlockType.ROW
    );

    if (!rowDistributionValid) {
      console.error(`Row-level distribution validation failed for plate ${plateIdx + 1}`);
    }

    // Fill positions and shuffle within rows
    rowAssignments.forEach((rowSamples, rowIdx) => {
      if (rowIdx < numRows) {
        // Shuffle samples within this row for final randomization
        const shuffledRowSamples = shuffleArray([...rowSamples]);

        // Place samples in the row
        for (let colIdx = 0; colIdx < Math.min(numColumns, shuffledRowSamples.length); colIdx++) {
          plates[plateIdx][rowIdx][colIdx] = shuffledRowSamples[colIdx];
        }
      }
    });
  });

  // Step 7: Validate repeated-measures constraints
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│           CONSTRAINT VALIDATION                             │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  validateRepeatedMeasuresConstraints(plateAssignments, repeatedMeasuresVariable);

  // Step 8: Calculate quality metrics
  console.log(`\n--- Step 8: Calculating quality metrics ---`);
  const qualityMetrics = calculateRepeatedMeasuresQualityMetrics(
    searches,
    groups,
    plateAssignments,
    plates,
    treatmentVariables,
    repeatedMeasuresVariable
  );

  console.log(`\n=== Repeated-Measures-Aware Randomization Complete ===\n`);

  // Return result with repeated-measures metadata
  return {
    plates,
    plateAssignments,
    repeatedMeasuresGroups: groups,
    qualityMetrics
  };
}

/**
 * Validates that repeated-measures constraints are satisfied after distribution.
 *
 * This function performs post-distribution validation to ensure that the fundamental
 * repeated-measures constraint is satisfied: all samples with the same subject ID
 * (repeated-measures variable value) must be assigned to the same plate. This is a
 * critical validation step that catches any algorithmic errors in the distribution process.
 *
 * **Validation Logic:**
 * 1. Iterate through all plates and their assigned samples
 * 2. For each sample with a subject ID, track which plate it's assigned to
 * 3. If a subject ID appears on multiple plates, record a violation
 * 4. Skip samples without subject IDs (singletons can be on any plate)
 * 5. Throw error if any violations are detected
 *
 * **What Constitutes a Violation:**
 * - Same subject ID (non-empty, non-whitespace value) appears on 2+ different plates
 * - Example: Patient_001 has samples on both Plate 1 and Plate 2
 *
 * **What is NOT a Violation:**
 * - Samples without subject ID (empty or whitespace) on different plates (singletons are independent)
 * - Same subject ID appearing multiple times on the SAME plate (expected behavior)
 * - Different subject IDs on different plates (expected behavior)
 *
 * **Example Usage:**
 * ```typescript
 * // After distributing groups to plates
 * const plateAssignments = new Map([
 *   [0, [sample1, sample2, sample3]], // Patient_001, Patient_001, Patient_002
 *   [1, [sample4, sample5, sample6]]  // Patient_003, Patient_003, Patient_004
 * ]);
 *
 * // This will pass validation (no subject ID appears on multiple plates)
 * validateRepeatedMeasuresConstraints(plateAssignments, 'PatientID');
 *
 * // This would fail validation:
 * const badAssignments = new Map([
 *   [0, [sample1, sample2]], // Patient_001, Patient_002
 *   [1, [sample3, sample4]]  // Patient_001, Patient_003  <- Patient_001 on both plates!
 * ]);
 * validateRepeatedMeasuresConstraints(badAssignments, 'PatientID'); // Throws error
 * ```
 *
 * **Validation Statistics Logged:**
 * - Total samples checked across all plates
 * - Number of unique subject IDs found
 * - Number of singletons (samples without subject ID)
 * - Number of violations detected
 * - Per-plate breakdown of samples with/without subject IDs
 *
 * **Error Message Format:**
 * If violations are detected, the error message includes:
 * - List of all violations with specific subject IDs and plate numbers
 * - Explanation of the constraint requirement
 * - Guidance for troubleshooting
 *
 * **Edge Cases:**
 * - All singletons: Validation passes (no subject IDs to track)
 * - Single plate: Validation always passes (can't split across plates)
 * - Empty plates: Skipped in validation
 * - Duplicate subject IDs on same plate: Not a violation (expected)
 * - Case-sensitive subject IDs: "Patient_001" and "patient_001" are different
 *
 * **Limitations:**
 * - Does not validate that groups are complete (missing samples)
 * - Does not check treatment composition within groups
 * - Does not validate row-level distribution
 * - Assumes subject IDs are strings (no type checking)
 * - Case-sensitive comparison (no normalization)
 *
 * **When This Function Should Be Called:**
 * - After plate distribution is complete
 * - Before returning results to user
 * - As a final sanity check on the algorithm
 * - Should NEVER fail if distribution algorithm is correct
 *
 * **If Validation Fails:**
 * This indicates a critical bug in the distribution algorithm. Possible causes:
 * - Group was split during flattening step
 * - Plate assignment logic has a bug
 * - Concurrent modification of assignments
 * - Data corruption during processing
 *
 * @param plateAssignments - Map of plate index (0-based) to array of samples assigned to that plate.
 *                          Each sample must have metadata with the repeated-measures variable.
 * @param repeatedMeasuresVariable - Name of the metadata field used for grouping (e.g., "PatientID", "SubjectID").
 *                                  This field's value is used to identify which samples must stay together.
 * @returns void - Function returns normally if validation passes
 *
 * @throws {Error} If any repeated-measures group is split across multiple plates. The error message includes:
 *                - List of all violations with subject IDs and plate numbers
 *                - Explanation of the constraint requirement
 *                - Guidance that all samples with same subject ID must be on same plate
 *
 * @see {@link doRepeatedMeasuresAwareRandomization} for where this validation is called
 * @see {@link distributeGroupsToPlates} for the distribution algorithm being validated
 */
function validateRepeatedMeasuresConstraints(
  plateAssignments: Map<number, SearchData[]>,
  repeatedMeasuresVariable: string
): void {
  console.log(`\nValidating repeated-measures constraints...`);
  console.log(`  - Variable: ${repeatedMeasuresVariable}`);
  console.log(`  - Plates to validate: ${plateAssignments.size}`);

  // Track which plate each subject ID is assigned to
  const subjectIdToPlate = new Map<string, number>();
  const violations: string[] = [];
  let totalSamplesChecked = 0;
  let singletonsFound = 0;

  // Check each plate's samples
  console.log(`\n  Checking plate assignments...`);
  plateAssignments.forEach((samples, plateIdx) => {
    let plateSubjectIds = 0;
    let plateSingletons = 0;

    samples.forEach(sample => {
      totalSamplesChecked++;
      const subjectId = sample.metadata[repeatedMeasuresVariable];

      // Skip samples without a subject ID (singletons are allowed anywhere)
      if (!subjectId || subjectId === '') {
        singletonsFound++;
        plateSingletons++;
        return;
      }

      plateSubjectIds++;

      // Check if this subject ID has been seen before
      if (subjectIdToPlate.has(subjectId)) {
        const previousPlateIdx = subjectIdToPlate.get(subjectId)!;

        // If it's on a different plate, we have a violation
        if (previousPlateIdx !== plateIdx) {
          const violationMsg = `Repeated-measures group '${subjectId}' is split across plates ${previousPlateIdx + 1} and ${plateIdx + 1}`;

          // Only add this violation once
          if (!violations.includes(violationMsg)) {
            violations.push(violationMsg);
            console.error(`    ❌ VIOLATION: ${violationMsg}`);
          }
        }
      } else {
        // First time seeing this subject ID, record its plate
        subjectIdToPlate.set(subjectId, plateIdx);
      }
    });

    console.log(`    Plate ${plateIdx + 1}: ${samples.length} samples (${plateSubjectIds} with subject ID, ${plateSingletons} singletons)`);
  });

  // Log validation results
  console.log(`\n  Validation statistics:`);
  console.log(`    - Total samples checked: ${totalSamplesChecked}`);
  console.log(`    - Unique subject IDs found: ${subjectIdToPlate.size}`);
  console.log(`    - Singletons found: ${singletonsFound}`);
  console.log(`    - Violations detected: ${violations.length}`);

  if (violations.length === 0) {
    console.log(`\n  ✓✓✓ VALIDATION PASSED ✓✓✓`);
    console.log(`  ✓ All repeated-measures groups are kept together on the same plate`);
    console.log(`  ✓ Validated ${subjectIdToPlate.size} unique subject IDs across ${plateAssignments.size} plates`);
    console.log(`  ✓ No constraint violations detected`);
  } else {
    console.error(`\n  ❌❌❌ VALIDATION FAILED ❌❌❌`);
    console.error(`  ❌ Found ${violations.length} constraint violation(s):`);
    violations.forEach((violation, idx) => {
      console.error(`     ${idx + 1}. ${violation}`);
    });

    // Throw error with all violations
    throw new Error(
      `Repeated-measures constraint validation failed:\n${violations.join('\n')}\n\n` +
      `All samples with the same ${repeatedMeasuresVariable} value must be assigned to the same plate.`
    );
  }
}

// Standard randomization implementation (existing algorithm)
function doStandardRandomization(
  searches: SearchData[],
  selectedCovariates: string[],
  keepEmptyInLastPlate: boolean = true,
  numRows: number = 8,
  numColumns: number = 12
): {
  plates: (SearchData | undefined)[][][];
  plateAssignments?: Map<number, SearchData[]>;
} {
  const totalSamples = searches.length;
  const plateSize = numRows * numColumns;
  console.log(`Starting balanced randomization for ${totalSamples} samples with plate size ${plateSize} (${numRows} rows x ${numColumns} columns)`);

  // Calculate number of plates needed (same regardless of keepEmptyInLastPlate)
  const actualPlatesNeeded = Math.ceil(totalSamples / plateSize);
  console.log(`Calculated plates needed: ${actualPlatesNeeded}`);
  const plateCapacities = assignBlockCapacities(totalSamples, actualPlatesNeeded, keepEmptyInLastPlate, plateSize, BlockType.PLATE);

  const plates = Array.from({ length: actualPlatesNeeded }, () =>
    Array.from({ length: numRows }, () => new Array(numColumns).fill(undefined))
  );

  // STEP 1: Group samples by covariate combinations
  const covariateGroups = groupByCovariates(searches, selectedCovariates);

  // STEP 1.5: Validate that we have enough capacity for all samples
  if (!validateCapacity(totalSamples, plateCapacities)) {
    // Return empty plates if validation fails
    return {
      plates: Array.from({ length: actualPlatesNeeded }, () =>
        Array.from({ length: numRows }, () => new Array(numColumns).fill(undefined))
      )
    };
  }

  // STEP 2: Calculate expected minimums per plate based on plate capacities
  const expectedMinimumsPerPlate = calculateExpectedMinimums(
    plateCapacities,
    covariateGroups,
    plateSize,
    BlockType.PLATE
  );

  // STEP 3: Distribute samples across plates
  const plateAssignments = distributeToBlocks(covariateGroups, plateCapacities, plateSize, selectedCovariates, BlockType.PLATE, expectedMinimumsPerPlate);

  // STEP 4: Validate plate-level distribution
  const plateDistributionValid = validatePerBlockDistribution(plateAssignments, selectedCovariates, expectedMinimumsPerPlate, BlockType.PLATE);
  if (!plateDistributionValid) {
    console.error("Plate-level distribution validation failed");
  }

  // STEP 5: For each plate, apply the distribution and randomization strategy to rows
  plateAssignments.forEach((plateSamples, plateIdx) => {

    // STEP 5B: Row-Based Distribution - Distribute samples across rows
    console.log(`Applying row-based distribution to plate ${plateIdx + 1} with ${plateSamples.length} samples`);

    // Shuffle plate samples before grouping to add initial randomization
    const shuffledPlateSamples = shuffleArray([...plateSamples]);

    // Group samples by covariates for this plate
    const plateGroups = groupByCovariates(shuffledPlateSamples, selectedCovariates);

    // Calculate how many rows we need
    const totalPlateSamples = plateSamples.length;
    const rowsNeeded = Math.ceil(totalPlateSamples / numColumns);
    const actualRowsToUse = Math.min(rowsNeeded, numRows);
    console.log(`Plate ${plateIdx + 1} has ${totalPlateSamples} samples, needs ${rowsNeeded} rows, using ${actualRowsToUse} rows`);

    // Calculate row capacities. Fill rows sequentially, leaving empty cells in the last row
    const rowCapacities = assignBlockCapacities(totalPlateSamples, actualRowsToUse, true, numColumns, BlockType.ROW);

    // Calculate expected minimums per row
    const expectedRowMinimums = calculateExpectedMinimums(
      rowCapacities,
      plateGroups,
      numColumns,
      BlockType.ROW
    );


    const rowAssignments = distributeToBlocks(plateGroups, rowCapacities, numColumns, selectedCovariates, BlockType.ROW, expectedRowMinimums);

    // Validate row-level distribution
    const rowDistributionValid = validatePerBlockDistribution(rowAssignments, selectedCovariates, expectedRowMinimums, BlockType.ROW);
    if (!rowDistributionValid) {
      console.error(`Row-level distribution validation failed for plate ${plateIdx}`);
    }

    // Fill positions and shuffle within rows
    rowAssignments.forEach((rowSamples, rowIdx) => {
      if (rowIdx < numRows) {
        // Shuffle samples within this row for final randomization
        const shuffledRowSamples = shuffleArray([...rowSamples]);

        // Place samples in the row
        for (let colIdx = 0; colIdx < Math.min(numColumns, shuffledRowSamples.length); colIdx++) {
          plates[plateIdx][rowIdx][colIdx] = shuffledRowSamples[colIdx];
        }
      }
    });

  });

  return {
    plates,
    plateAssignments
  };
}