import { SearchData } from '../types';
import { shuffleArray, getCovariateKey } from '../utils';

function groupByCovariates(searches: SearchData[], selectedCovariates: string[]): Map<string, SearchData[]> {
    const groups = new Map<string, SearchData[]>();

    searches.forEach(search => {
        const key = getCovariateKey(search, selectedCovariates);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(search);
    });

    return groups;
}

function distributeToBlocks(
    covariateGroups: Map<string, SearchData[]>,
    numBlocks: number,
    blockCapacity: number
): Map<number, SearchData[]> {
    const [blockAssignments, blockCounts] = initializeBlockAssignments(numBlocks);

    // Create uniform capacities array for validation
    const blockCapacities = Array(numBlocks).fill(blockCapacity);
    const totalSamples = Array.from(covariateGroups.values()).reduce((sum, samples) => sum + samples.length, 0);

    if (!validateCapacity(totalSamples, blockCapacities)) {
        return blockAssignments;
    }

    // PHASE 1: Place proportional samples
    const [unplacedGroupsMap, remainingSamplesMap] = placeProportionalSamples(
        covariateGroups,
        blockCapacities, // All blocks have uniform capacity
        blockAssignments,
        blockCounts
    );

    // Combine unplaced and remaining samples for Phase 2
    const allRemainingSamples = new Map<string, SearchData[]>();
    unplacedGroupsMap.forEach((samples, groupKey) => {
        allRemainingSamples.set(groupKey, samples);
    });
    remainingSamplesMap.forEach((samples, groupKey) => {
        if (allRemainingSamples.has(groupKey)) {
            // Combine samples if group exists in both maps
            const existingSamples = allRemainingSamples.get(groupKey)!;
            allRemainingSamples.set(groupKey, [...existingSamples, ...samples]);
        } else {
            allRemainingSamples.set(groupKey, samples);
        }
    });

    // PHASE 2: Distribute remaining samples one covariate group at a time
    const sortedRemainingGroups = Array.from(allRemainingSamples.entries())
        .sort(([, samplesA], [, samplesB]) => samplesB.length - samplesA.length);

    sortedRemainingGroups.forEach(([groupKey, remainingSamples]) => {
        console.log(`Phase 2: Remaining samples for group ${groupKey}: ${remainingSamples.length}`);

        // Get blocks with available capacity
        const availableBlocks = getAvailableBlocks(numBlocks, blockCapacities, blockCounts);

        if (availableBlocks.length === 0) {
            console.error(`Phase 2 (Blocks): No available capacity for remaining samples from group ${groupKey}`);
            return;
        }

        const placedSamples = distributeSamplesAcrossPlates(
            remainingSamples,
            availableBlocks,
            blockCapacities,
            blockAssignments,
            blockCounts,
            "Placing 1 remaining"
        );

        if (placedSamples < remainingSamples.length) {
            console.error(`Phase 2 (Blocks): Failed to place ${remainingSamples.length - placedSamples} remaining samples from group ${groupKey}`);
        }
    });

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
            console.log(`  Block is available. Index: ${blockIdx}; Capacity: ${availableCapacity}`);
            availableBlocks.push(blockIdx);
        }
    }
    return availableBlocks;
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
    blockCounts: number[]
): [Map<string, SearchData[]>, Map<string, SearchData[]>] {
    const numPlates = plateCapacities.length;
    const unplacedGroupsMap = new Map<string, SearchData[]>();
    const overflowSamplesMap = new Map<string, SearchData[]>();

    covariateGroups.forEach((samples, groupKey) => {
        const shuffledSamples = shuffleArray([...samples]);
        const totalGroupSamples = shuffledSamples.length;
        const baseSamplesPerPlate = Math.floor(totalGroupSamples / numPlates);

        let sampleIndex = 0;
        console.log(`Phase 1: Minimum required samples for group ${groupKey} (${totalGroupSamples}/${numPlates}): ${baseSamplesPerPlate}`);

        // Place samples proportionally in all plates based on capacity ratio
        if (baseSamplesPerPlate > 0) {
            for (let plateIdx = 0; plateIdx < numPlates; plateIdx++) {
                const capacityRatio = plateCapacities[plateIdx] / 96;
                const proportionalSamples = Math.floor(baseSamplesPerPlate * capacityRatio);

                console.log(`  Placing proportional samples in plate index ${plateIdx}: ${proportionalSamples} (capacity ratio: ${capacityRatio.toFixed(2)})`);

                const availableCapacity = plateCapacities[plateIdx] - blockCounts[plateIdx];
                const samplesToPlace = Math.min(proportionalSamples, availableCapacity);

                if (samplesToPlace < proportionalSamples) {
                    console.error(`Phase 1 (Plates): Plate ${plateIdx} cannot accommodate proportional ${proportionalSamples} samples for group ${groupKey}. Only ${samplesToPlace} can be placed.`);
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

// Helper function to distribute samples across available plates
function distributeSamplesAcrossPlates(
    remainingSamples: SearchData[],
    availablePlates: number[],
    plateCapacities: number[],
    blockAssignments: Map<number, SearchData[]>,
    blockCounts: number[],
    logPrefix: string,
    preserveOrder: boolean = false
): number {
    const platesToUse = preserveOrder ? [...availablePlates] : shuffleArray([...availablePlates]);
    let sampleIndex = 0;
    let plateIndex = 0;

    while (sampleIndex < remainingSamples.length && platesToUse.length > 0) {
        const plateIdx = platesToUse[plateIndex % platesToUse.length];

        if (blockCounts[plateIdx] < plateCapacities[plateIdx]) {
            console.log(`  ${logPrefix} sample in plate index: ${plateIdx}`);
            blockAssignments.get(plateIdx)!.push(remainingSamples[sampleIndex]);
            blockCounts[plateIdx]++;
            sampleIndex++;
        } else {
            platesToUse.splice(plateIndex % platesToUse.length, 1);
            if (platesToUse.length === 0) break;
            plateIndex = plateIndex % platesToUse.length;
            continue;
        }

        plateIndex = (plateIndex + 1) % platesToUse.length;
    }

    return sampleIndex;
}

// Helper function for Phase 2A - unplaced groups
function processUnplacedGroups(
    unplacedGroupsMap: Map<string, SearchData[]>,
    plateCapacities: number[],
    blockAssignments: Map<number, SearchData[]>,
    blockCounts: number[]
): void {
    const numPlates = plateCapacities.length;
    const sortedUnplacedGroups = Array.from(unplacedGroupsMap.entries())
        .sort(([, samplesA], [, samplesB]) => samplesB.length - samplesA.length);

    sortedUnplacedGroups.forEach(([groupKey, remainingSamples]) => {
        console.log(`Phase 2A: Unplaced group ${groupKey}: ${remainingSamples.length} samples`);

        const availablePlates = getAvailableBlocks(numPlates, plateCapacities, blockCounts);

        if (availablePlates.length === 0) {
            console.error(`Phase 2A (Plates): No available capacity for unplaced group ${groupKey}`);
            return;
        }

        const placedSamples = distributeSamplesAcrossPlates(
            remainingSamples,
            availablePlates,
            plateCapacities,
            blockAssignments,
            blockCounts,
            "Placing 1 unplaced"
        );

        if (placedSamples < remainingSamples.length) {
            console.error(`Phase 2A (Plates): Failed to place ${remainingSamples.length - placedSamples} unplaced samples from group ${groupKey}`);
        }
    });
}

// Helper function for Phase 2B - overflow groups with full plate priority
function processOverflowGroups(
    overflowSamplesMap: Map<string, SearchData[]>,
    plateCapacities: number[],
    blockAssignments: Map<number, SearchData[]>,
    blockCounts: number[]
): void {
    const numPlates = plateCapacities.length;
    const sortedOverflowGroups = Array.from(overflowSamplesMap.entries())
        .sort(([, samplesA], [, samplesB]) => samplesB.length - samplesA.length);

    sortedOverflowGroups.forEach(([groupKey, remainingSamples]) => {
        console.log(`Phase 2B: Overflow group ${groupKey}: ${remainingSamples.length} samples`);

        const fullPlatesAvailable = [];
        const partialPlatesAvailable = [];

        for (let plateIdx = 0; plateIdx < numPlates; plateIdx++) {
            const availableCapacity = plateCapacities[plateIdx] - blockCounts[plateIdx];
            if (availableCapacity > 0) {
                console.log(`  Plate is available. Index: ${plateIdx}; Capacity: ${availableCapacity}`);
                if (plateCapacities[plateIdx] === 96) {
                    fullPlatesAvailable.push(plateIdx);
                } else {
                    partialPlatesAvailable.push(plateIdx);
                }
            }
        }

        if (fullPlatesAvailable.length === 0 && partialPlatesAvailable.length === 0) {
            console.error(`Phase 2B (Plates): No available capacity for overflow group ${groupKey}`);
            return;
        }

        // Prioritize full plates, then partial plates
        const shuffledFullPlates = shuffleArray([...fullPlatesAvailable]);
        const shuffledPartialPlates = shuffleArray([...partialPlatesAvailable]);
        const prioritizedPlates = [...shuffledFullPlates, ...shuffledPartialPlates];

        const placedSamples = distributeSamplesAcrossPlates(
            remainingSamples,
            prioritizedPlates,
            plateCapacities,
            blockAssignments,
            blockCounts,
            "Placing 1 overflow",
            true // Preserve priority order (full plates first, then partial)
        );

        if (placedSamples < remainingSamples.length) {
            console.error(`Phase 2B (Plates): Failed to place ${remainingSamples.length - placedSamples} overflow samples from group ${groupKey}`);
        }
    });
}

// Main function - now much simpler and more readable
function distributeToBlocksWithCapacities(
    covariateGroups: Map<string, SearchData[]>,
    plateCapacities: number[]
): Map<number, SearchData[]> {
    const numPlates = plateCapacities.length;
    const [blockAssignments, blockCounts] = initializeBlockAssignments(numPlates);

    // Validate capacity
    const totalSamples = Array.from(covariateGroups.values()).reduce((sum, samples) => sum + samples.length, 0);
    if (!validateCapacity(totalSamples, plateCapacities)) {
        return blockAssignments;
    }

    // Phase 1: Proportional placement
    const [unplacedGroupsMap, overflowSamplesMap] = placeProportionalSamples(
        covariateGroups,
        plateCapacities,
        blockAssignments,
        blockCounts
    );

    // Phase 2A: Process unplaced groups
    processUnplacedGroups(unplacedGroupsMap, plateCapacities, blockAssignments, blockCounts);

    // Phase 2B: Process overflow groups, prioritizing full plates
    processOverflowGroups(overflowSamplesMap, plateCapacities, blockAssignments, blockCounts);

    return blockAssignments;
}

// Additional validation function to verify distribution
function validateDistribution(
    blockAssignments: Map<number, SearchData[]>,
    selectedCovariates: string[],
    expectedMinimum: { [groupKey: string]: number },
    blockType: string = "block"
): boolean {
    let isValid = true;

    blockAssignments.forEach((samples, blockIdx) => {
        const groupCounts = new Map<string, number>();

        // Count samples by group in this block
        samples.forEach(sample => {
            const groupKey = getCovariateKey(sample, selectedCovariates);
            groupCounts.set(groupKey, (groupCounts.get(groupKey) || 0) + 1);
        });

        // Check if each group meets minimum requirements
        Object.entries(expectedMinimum).forEach(([groupKey, minCount]) => {
            const actualCount = groupCounts.get(groupKey) || 0;
            if (actualCount < minCount) {
                console.error(`Validation: ${blockType} ${blockIdx} has only ${actualCount} samples for group ${groupKey}, expected minimum ${minCount}`);
                isValid = false;
            }
        });
    });

    return isValid;
}

// Balanced block randomization with validation
export function balancedBlockRandomization(
    searches: SearchData[],
    selectedCovariates: string[],
    keepEmptyInLastPlate: boolean = true
): (SearchData | undefined)[][][] {
    const totalSamples = searches.length;

    // Calculate number of plates needed (same regardless of keepEmptyInLastPlate)
    const actualPlatesNeeded = Math.ceil(totalSamples / 96);
    let plateCapacities: number[];

    if (keepEmptyInLastPlate) {
        // Calculate how many plates should be completely filled
        const fullPlates = Math.floor(totalSamples / 96);
        const remainingSamples = totalSamples % 96;

        // Set capacities: full plates get 96, last plate gets remaining samples
        plateCapacities = Array(fullPlates).fill(96);
        if (remainingSamples > 0) {
            plateCapacities.push(remainingSamples);
        }
    } else {
        // Original behavior: all plates have full capacity
        plateCapacities = Array(actualPlatesNeeded).fill(96);
    }

    const plates = Array.from({ length: actualPlatesNeeded }, () =>
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
    );

    // STEP 1: Group samples by covariate combinations
    const covariateGroups = groupByCovariates(searches, selectedCovariates);

    // STEP 2: Calculate expected minimums for validation
    const expectedMinimums: { [groupKey: string]: number } = {};
    let effectivePlatesForMinimum: number;

    if (keepEmptyInLastPlate) {
        // Based on full plates only
        const fullPlates = Math.floor(totalSamples / 96);
        effectivePlatesForMinimum = fullPlates > 0 ? fullPlates : 1;
    } else {
        // Based on all plates
        effectivePlatesForMinimum = actualPlatesNeeded;
    }

    covariateGroups.forEach((samples, groupKey) => {
        expectedMinimums[groupKey] = Math.floor(samples.length / effectivePlatesForMinimum);
    });

    // STEP 3: Distribute samples across plates
    const plateAssignments = keepEmptyInLastPlate
        ? distributeToBlocksWithCapacities(covariateGroups, plateCapacities)
        : distributeToBlocks(covariateGroups, actualPlatesNeeded, 96);

    // STEP 4: Validate plate-level distribution
    const plateDistributionValid = validateDistribution(plateAssignments, selectedCovariates, expectedMinimums, "plate");
    if (!plateDistributionValid) {
        console.error("Plate-level distribution validation failed");
    }

    // STEP 5: For each plate, distribute samples across rows with validation
    plateAssignments.forEach((plateSamples, plateIdx) => {
        // Group samples by covariates for this plate
        const plateGroups = groupByCovariates(plateSamples, selectedCovariates);

        // Calculate expected minimums for rows
        const rowMinimums: { [groupKey: string]: number } = {};
        plateGroups.forEach((samples, groupKey) => {
            // Always use all 8 rows for minimum calculation
            // This gives the true minimum guaranteed samples per row
            rowMinimums[groupKey] = Math.floor(samples.length / 8);
        });

        // Distribute samples across rows
        const totalPlateSamples = plateSamples.length;
        const rowsNeeded = Math.ceil(totalPlateSamples / 12);
        const actualRowsToUse = Math.min(rowsNeeded, 8);

        const rowAssignments = distributeToBlocks(plateGroups, actualRowsToUse, 12);

        // Validate row-level distribution
        const rowDistributionValid = validateDistribution(rowAssignments, selectedCovariates, rowMinimums, `plate ${plateIdx + 1} row`);
        if (!rowDistributionValid) {
            console.error(`Row-level distribution validation failed for plate ${plateIdx}`);
        }

        // STEP 6: Fill the actual plate positions and shuffle within rows
        rowAssignments.forEach((rowSamples, rowIdx) => {
            if (rowIdx < 8) {
                // Shuffle samples within this row for final randomization
                const shuffledRowSamples = shuffleArray([...rowSamples]);

                // Place samples in the row
                for (let colIdx = 0; colIdx < Math.min(12, shuffledRowSamples.length); colIdx++) {
                    plates[plateIdx][rowIdx][colIdx] = shuffledRowSamples[colIdx];
                }
            }
        });
    });

    return plates;
}