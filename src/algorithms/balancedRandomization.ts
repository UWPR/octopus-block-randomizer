import { SearchData } from '../types';
import { shuffleArray, getCovariateKey, groupByCovariates, analyzeNeighbors } from '../utils';

enum OverflowPrioritization {
  BY_CAPACITY = 'by_capacity',      // Prioritize higher capacity blocks (for plates)
  BY_GROUP_BALANCE = 'by_group_balance',  // Prioritize blocks with fewer samples of current group (for rows)
  NONE = 'none'                     // No prioritization - all available blocks considered equally
}



function distributeToBlocks(
  covariateGroups: Map<string, SearchData[]>,
  blockCapacities: number[],
  maxCapacity: number,
  selectedCovariates: string[],
  blockType: string,
  expectedMinimums?: { [blockIdx: number]: { [groupKey: string]: number } }
): Map<number, SearchData[]> {
  const numBlocks = blockCapacities.length;
  const [blockAssignments, blockCounts] = initializeBlockAssignments(numBlocks);

  console.log(`Distributing samples across ${numBlocks} ${blockType.toLowerCase()} with capacities: ${blockCapacities.join(', ')}`);

  // PHASE 1: Place samples proportionately in plates
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
  const prioritization = blockType === "Plates" ? OverflowPrioritization.BY_CAPACITY : OverflowPrioritization.BY_GROUP_BALANCE;
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

// Helper function to assign plate capacities based on distribution strategy
function assignPlateCapacities(
  totalSamples: number,
  actualPlatesNeeded: number,
  keepEmptyInLastPlate: boolean,
  plateSize: number
): number[] {
  let plateCapacities: number[];

  if (keepEmptyInLastPlate) {
    // Calculate how many plates should be completely filled
    const fullPlates = Math.floor(totalSamples / plateSize);
    const remainingSamples = totalSamples % plateSize;

    // Set capacities: full plates get plateSize, last plate gets remaining samples
    plateCapacities = Array(fullPlates).fill(plateSize);
    if (remainingSamples > 0) {
      plateCapacities.push(remainingSamples);
    }

    console.log(`Keep empty in last plate: ${totalSamples} samples across ${plateCapacities.length} plates with capacities: ${plateCapacities.join(', ')}`);
  } else {
    // Distribute empty spots evenly across all plates
    const baseSamplesPerPlate = Math.floor(totalSamples / actualPlatesNeeded);
    const extraSamples = totalSamples % actualPlatesNeeded;

    plateCapacities = Array(actualPlatesNeeded).fill(baseSamplesPerPlate);
    for (let i = 0; i < extraSamples; i++) {
      plateCapacities[i]++;
    }

    console.log(`Even distribution of empty spots: ${totalSamples} samples across ${actualPlatesNeeded} plates with capacities: ${plateCapacities.join(', ')}`);
  }

  return plateCapacities;
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
  blockType: string = "blocks",
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
  blockType: string = "blocks"
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

    const placedSamples = distributeSamplesAcrossBlocks(
      remainingSamples,
      availableBlocks,
      blockCapacities,
      blockAssignments,
      blockCounts,
      `Placing 1 unplaced (${blockType})`
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
  blockType: string = "blocks",
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
  blockTypeName: string
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
  return doBalancedRandomization(searches, selectedCovariates, keepEmptyInLastPlate, numRows, numColumns, false);
}

// Core balanced randomization implementation
function doBalancedRandomization(
  searches: SearchData[],
  selectedCovariates: string[],
  keepEmptyInLastPlate: boolean = true,
  numRows: number = 8,
  numColumns: number = 12,
  useSpatialOptimization: boolean = false
): {
  plates: (SearchData | undefined)[][][];
  plateAssignments?: Map<number, SearchData[]>;
} {
  const totalSamples = searches.length;
  const plateSize = numRows * numColumns;

  // Calculate number of plates needed (same regardless of keepEmptyInLastPlate)
  const actualPlatesNeeded = Math.ceil(totalSamples / plateSize);
  const plateCapacities = assignPlateCapacities(totalSamples, actualPlatesNeeded, keepEmptyInLastPlate, plateSize);

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
  const expectedMinimumsPerPlate: { [plateIdx: number]: { [groupKey: string]: number } } = {};

  plateCapacities.forEach((capacity, plateIdx) => {
    expectedMinimumsPerPlate[plateIdx] = {};
    covariateGroups.forEach((samples, groupKey) => {
      // Calculate expected minimum for this covariate group on this specific plate
      // Based on the plate's capacity relative to a full plate
      const capacityRatio = capacity / plateSize;
      const globalExpected = Math.floor(samples.length / actualPlatesNeeded);
      expectedMinimumsPerPlate[plateIdx][groupKey] = Math.round(globalExpected * capacityRatio);
    });
  });

  // STEP 3: Distribute samples across plates
  const plateAssignments = distributeToBlocks(covariateGroups, plateCapacities, plateSize, selectedCovariates, "Plates", expectedMinimumsPerPlate);

  // STEP 4: Validate plate-level distribution
  const plateDistributionValid = validatePerBlockDistribution(plateAssignments, selectedCovariates, expectedMinimumsPerPlate, "plate");
  if (!plateDistributionValid) {
    console.error("Plate-level distribution validation failed");
  }

  // STEP 5: For each plate, apply the randomization strategy
  plateAssignments.forEach((plateSamples, plateIdx) => {
    
    // STEP 5B: Row-Based Distribution - Distribute samples across rows with validation
    console.log(`Applying row-based distribution to plate ${plateIdx + 1} with ${plateSamples.length} samples`);

    // Shuffle plate samples before grouping to add initial randomization
    const shuffledPlateSamples = shuffleArray([...plateSamples]);

    // Group samples by covariates for this plate
    const plateGroups = groupByCovariates(shuffledPlateSamples, selectedCovariates);

    // Calculate how many rows we need
    const totalPlateSamples = plateSamples.length;
    const rowsNeeded = Math.ceil(totalPlateSamples / numColumns);
    const actualRowsToUse = Math.min(rowsNeeded, numRows);

    // Calculate expected minimums per row
    const expectedRowMinimums: { [rowIdx: number]: { [groupKey: string]: number } } = {};
    for (let rowIdx = 0; rowIdx < actualRowsToUse; rowIdx++) {
      expectedRowMinimums[rowIdx] = {};
      plateGroups.forEach((samples, groupKey) => {
        const expectedPerRow = Math.floor(samples.length / actualRowsToUse);
        expectedRowMinimums[rowIdx][groupKey] = expectedPerRow;
      });
    }

    // Calculate row capacities for even distribution
    const totalPlateSamplesForCapacity = plateSamples.length;
    const baseSamplesPerRow = Math.floor(totalPlateSamplesForCapacity / actualRowsToUse);
    const extraSamplesForRows = totalPlateSamplesForCapacity % actualRowsToUse;

    const rowCapacities = Array(actualRowsToUse).fill(baseSamplesPerRow);
    for (let i = 0; i < extraSamplesForRows; i++) {
      rowCapacities[i]++;
    }

    const rowAssignments = distributeToBlocks(plateGroups, rowCapacities, numColumns, selectedCovariates, "Rows", expectedRowMinimums);

    // Validate row-level distribution
    const rowDistributionValid = validatePerBlockDistribution(rowAssignments, selectedCovariates, expectedRowMinimums, "row");
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