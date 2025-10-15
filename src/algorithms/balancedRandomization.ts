import { SearchData } from '../types';
import { shuffleArray, getCovariateKey, groupByCovariates } from '../utils';

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



/**
 * Greedy-inspired spatial randomization to minimize covariate clustering
 * Uses constraint-based placement with increasing tolerance for optimal spatial distribution
 */
function optimizeSpatialRandomization(
    samples: SearchData[],
    numRows: number,
    numColumns: number,
    selectedCovariates: string[]
): (SearchData | undefined)[][] {
    const plate: (SearchData | undefined)[][] = Array.from({ length: numRows }, () =>
        new Array(numColumns).fill(undefined)
    );

    if (samples.length === 0) return plate;

    // Shuffle samples for randomization
    const shuffledSamples = shuffleArray([...samples]);

    // GREEDY-INSPIRED PLACEMENT: Place each sample in the position that minimizes local clustering
    for (const sample of shuffledSamples) {
        const availablePositions = getAvailablePositions(plate, numRows, numColumns);
        if (availablePositions.length === 0) break; // No more space

        let bestPosition: { row: number; col: number } | null = null;
        let bestScore = -1;
        let tolerance = 0;

        // Try with increasing tolerance until we find a placement
        while (bestPosition === null && tolerance <= 8) {
            // Evaluate each position and find the best one
            for (const pos of availablePositions) {
                if (canPlaceSampleAtPosition(sample, plate, pos.row, pos.col, selectedCovariates, tolerance)) {
                    const score = calculatePositionScore(sample, plate, pos.row, pos.col, selectedCovariates);
                    if (score > bestScore) {
                        bestScore = score;
                        bestPosition = { row: pos.row, col: pos.col };
                    }
                }
            }

            // If no position found with current tolerance, increase tolerance
            if (bestPosition === null) {
                tolerance++;
            }
        }

        // Place the sample at the best position found, or fallback to first available
        const positionToUse = bestPosition || availablePositions[0];
        if (positionToUse) {
            plate[positionToUse.row][positionToUse.col] = sample;
        }
    }

    console.log(`Greedy spatial placement completed for ${samples.length} samples`);
    return plate;
}

/**
 * Get all available (empty) positions in the plate
 */
function getAvailablePositions(
    plate: (SearchData | undefined)[][],
    numRows: number,
    numColumns: number
): Array<{ row: number; col: number }> {
    const positions = [];
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numColumns; col++) {
            if (plate[row][col] === undefined) {
                positions.push({ row, col });
            }
        }
    }
    return positions;
}

/**
 * Check if a sample can be placed at a position with given tolerance
 * Tolerance = maximum number of similar neighbors allowed
 */
function canPlaceSampleAtPosition(
    sample: SearchData,
    plate: (SearchData | undefined)[][],
    row: number,
    col: number,
    selectedCovariates: string[],
    tolerance: number
): boolean {
    const sampleKey = getCovariateKey(sample, selectedCovariates);
    let similarNeighbors = 0;

    // Check all 8 neighbors
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue; // Skip self

            const newRow = row + dr;
            const newCol = col + dc;

            if (newRow >= 0 && newRow < plate.length && newCol >= 0 && newCol < plate[0].length) {
                const neighbor = plate[newRow][newCol];
                if (neighbor && getCovariateKey(neighbor, selectedCovariates) === sampleKey) {
                    similarNeighbors++;
                }
            }
        }
    }

    return similarNeighbors <= tolerance;
}

/**
 * Calculate a score for placing a sample at a position (higher = better for randomization)
 * Considers both immediate neighbors and broader spatial distribution
 */
function calculatePositionScore(
    sample: SearchData,
    plate: (SearchData | undefined)[][],
    row: number,
    col: number,
    selectedCovariates: string[]
): number {
    const sampleKey = getCovariateKey(sample, selectedCovariates);
    let score = 100; // Start with perfect score

    // Penalty for similar immediate neighbors (8-connected)
    let similarNeighbors = 0;
    let totalNeighbors = 0;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const newRow = row + dr;
            const newCol = col + dc;

            if (newRow >= 0 && newRow < plate.length && newCol >= 0 && newCol < plate[0].length) {
                const neighbor = plate[newRow][newCol];
                if (neighbor) {
                    totalNeighbors++;
                    if (getCovariateKey(neighbor, selectedCovariates) === sampleKey) {
                        similarNeighbors++;
                    }
                }
            }
        }
    }

    // Heavy penalty for similar neighbors
    if (totalNeighbors > 0) {
        const similarRatio = similarNeighbors / totalNeighbors;
        score -= similarRatio * 50; // Up to 50 point penalty
    }

    // Additional penalty for similar samples in same row/column
    let similarInRow = 0;
    let similarInCol = 0;

    // Check row
    for (let c = 0; c < plate[0].length; c++) {
        if (c !== col && plate[row][c] && getCovariateKey(plate[row][c]!, selectedCovariates) === sampleKey) {
            similarInRow++;
        }
    }

    // Check column
    for (let r = 0; r < plate.length; r++) {
        if (r !== row && plate[r][col] && getCovariateKey(plate[r][col]!, selectedCovariates) === sampleKey) {
            similarInCol++;
        }
    }

    // Moderate penalty for row/column clustering
    score -= (similarInRow + similarInCol) * 5;

    return Math.max(0, score);
}

/**
 * Calculate clustering score for a plate (same logic as quality metrics)
 */
function calculatePlateClusteringScore(
    plate: (SearchData | undefined)[][],
    selectedCovariates: string[]
): number {
    const numRows = plate.length;
    const numCols = plate[0]?.length || 0;

    let totalComparisons = 0;
    let differentNeighbors = 0;

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const currentSample = plate[row][col];
            if (!currentSample) continue;

            const currentKey = getCovariateKey(currentSample, selectedCovariates);

            // Check all 8 neighbors
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;

                    const newRow = row + dr;
                    const newCol = col + dc;

                    if (newRow >= 0 && newRow < numRows && newCol >= 0 && newCol < numCols) {
                        const neighborSample = plate[newRow][newCol];
                        if (!neighborSample) continue;

                        const neighborKey = getCovariateKey(neighborSample, selectedCovariates);
                        totalComparisons++;

                        if (currentKey !== neighborKey) {
                            differentNeighbors++;
                        }
                    }
                }
            }
        }
    }

    if (totalComparisons === 0) return 100;
    return (differentNeighbors / totalComparisons) * 100;
}

// Balanced block randomization with validation
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

    // STEP 5: For each plate, distribute samples across rows with validation
    plateAssignments.forEach((plateSamples, plateIdx) => {
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

        // STEP 6: Collect all plate samples and perform advanced spatial randomization
        const allPlateSamples: SearchData[] = [];
        rowAssignments.forEach((rowSamples) => {
            allPlateSamples.push(...rowSamples);
        });

        // STEP 7: Apply anti-clustering spatial randomization for maximum randomization score
        const spatiallyOptimizedPlate = optimizeSpatialRandomization(
            allPlateSamples,
            numRows,
            numColumns,
            selectedCovariates
        );

        // Fill the plate with spatially optimized positions
        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
            for (let colIdx = 0; colIdx < numColumns; colIdx++) {
                plates[plateIdx][rowIdx][colIdx] = spatiallyOptimizedPlate[rowIdx][colIdx];
            }
        }
    });

    return {
        plates,
        plateAssignments
    };
}