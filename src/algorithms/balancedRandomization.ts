import { SearchData } from '../utils/types';
import { BlockType } from '../utils/types';
import { shuffleArray, getCovariateKey, groupByCovariates } from '../utils/utils';
import { greedyPlaceInRow, analyzePlateSpatialQuality, optimizeAllPlates } from './greedySpatialPlacement';

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
      const capacityRatio = totalBlocksNeeded === 1 ? 1 : capacity / fullBlockCapacity;
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
export function balancedBlockRandomization(
  searches: SearchData[],
  selectedCovariates: string[],
  keepEmptyInLastPlate: boolean = true,
  numRows: number = 8,
  numColumns: number = 12
): {
  plates: (SearchData | undefined)[][][];
  plateAssignments?: Map<number, SearchData[]>;
} {
  return doBalancedRandomization(searches, selectedCovariates, keepEmptyInLastPlate, numRows, numColumns);
}

// Core balanced randomization implementation
function doBalancedRandomization(
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

    // Fill positions using greedy spatial placement to minimize clustering
    rowAssignments.forEach((rowSamples, rowIdx) => {
      if (rowIdx < numRows) {
        // Use greedy placement instead of simple shuffling
        greedyPlaceInRow(
          rowSamples,
          plates[plateIdx],
          rowIdx,
          selectedCovariates,
          numColumns
        );
      }
    });

    const spatialQuality = analyzePlateSpatialQuality(plates[plateIdx], selectedCovariates, numRows, numColumns);
    console.log(`Spatial Quality Analysis: Plate ${plateIdx + 1}: H=${spatialQuality.horizontalClusters}, V=${spatialQuality.verticalClusters}, CR=${spatialQuality.crossRowClusters}, Total=${spatialQuality.totalClusters}`);
  });

  // STEP 6: Global optimization pass - swap positions to further reduce clustering
  console.log('\n=== Starting Global Optimization ===');
  const totalImprovements = optimizeAllPlates(plates, selectedCovariates, numRows, numColumns, 100);
  console.log(`=== Optimization Complete: ${totalImprovements} total improvements ===\n`);

  // STEP 7: Analyze spatial quality after optimization
  console.log('Final Spatial Quality Analysis:');
  plateAssignments.forEach((_, plateIdx) => {
    const finalQuality = analyzePlateSpatialQuality(plates[plateIdx], selectedCovariates, numRows, numColumns);
    console.log(`  Plate ${plateIdx + 1}: H=${finalQuality.horizontalClusters}, V=${finalQuality.verticalClusters}, CR=${finalQuality.crossRowClusters}, Total=${finalQuality.totalClusters}`);
  });

  return {
    plates,
    plateAssignments
  };
}