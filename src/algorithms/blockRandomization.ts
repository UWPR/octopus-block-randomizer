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
    const blockAssignments = new Map<number, SearchData[]>();
    const blockCounts = new Array(numBlocks).fill(0);
    
    // Initialize block assignments
    for (let i = 0; i < numBlocks; i++) {
        blockAssignments.set(i, []);
    }
    
    // Calculate total samples and verify we have enough capacity
    const totalSamples = Array.from(covariateGroups.values()).reduce((sum, samples) => sum + samples.length, 0);
    const totalCapacity = numBlocks * blockCapacity;
    
    console.log(`Block size: ${blockCapacity}; Number of blocks: ${numBlocks}; Sample count: ${totalSamples}`);

    if (totalSamples > totalCapacity) {
        console.error(`Not enough capacity: ${totalSamples} samples > ${totalCapacity} total capacity`);
        return blockAssignments;
    }
    
    // Store remaining samples for Phase 2
    const remainingSamplesMap = new Map<string, SearchData[]>();
    
    // PHASE 1: Place minimum required samples from ALL covariate groups
    covariateGroups.forEach((samples, groupKey) => {
        const shuffledSamples = shuffleArray([...samples]);
        const totalGroupSamples = shuffledSamples.length;
        const baseSamplesPerBlock = Math.floor(totalGroupSamples / numBlocks);
        
        let sampleIndex = 0;
        
        console.log(`Phase 1: Minimum required samples for group ${groupKey} (${totalGroupSamples}/${numBlocks}): ${baseSamplesPerBlock}`); 

        // Place minimum required samples in each block for this group
        if (baseSamplesPerBlock > 0) {
            for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
                console.log(`  Placing minimum required samples in block index ${blockIdx}`);

                // Check if we have capacity for the minimum required samples
                const availableCapacity = blockCapacity - blockCounts[blockIdx];
                const samplesToPlace = Math.min(baseSamplesPerBlock, availableCapacity);
                
                if (samplesToPlace < baseSamplesPerBlock) {
                    console.error(`Phase 1 (Blocks): Block ${blockIdx} cannot accommodate minimum ${baseSamplesPerBlock} samples for group ${groupKey}. Only ${samplesToPlace} can be placed.`);
                }
                
                // Place the guaranteed minimum samples
                for (let i = 0; i < samplesToPlace && sampleIndex < shuffledSamples.length; i++) {
                    blockAssignments.get(blockIdx)!.push(shuffledSamples[sampleIndex++]);
                    blockCounts[blockIdx]++;
                }
            }
        }
        
        // Store any remaining samples for Phase 2
        if (sampleIndex < shuffledSamples.length) {
            const remainingSamples = shuffledSamples.slice(sampleIndex);
            remainingSamplesMap.set(groupKey, remainingSamples);
        }
    });
    
    // PHASE 2: Distribute remaining samples one covariate group at a time
    remainingSamplesMap.forEach((remainingSamples, groupKey) => {
        console.log(`Phase 2: Remaining samples for group ${groupKey}: ${remainingSamples.length}`);
        
        // Get blocks with available capacity
        const availableBlocks = [];
        for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
            const availableCapacity = blockCapacity - blockCounts[blockIdx];
            if (availableCapacity > 0) {
                console.log(`  Block is available. Index: ${blockIdx}; Capacity: ${availableCapacity}`);
                availableBlocks.push(blockIdx);
            }
        }
        
        if (availableBlocks.length === 0) {
            console.error(`Phase 2 (Blocks): No available capacity for remaining samples from group ${groupKey}`);
            return;
        }
        
        // Shuffle available blocks for random distribution
        const shuffledAvailableBlocks = shuffleArray([...availableBlocks]);
        
        // Distribute remaining samples from this group across available blocks
        let sampleIndex = 0;
        let blockIndex = 0;
        
        while (sampleIndex < remainingSamples.length && shuffledAvailableBlocks.length > 0) {
            const blockIdx = shuffledAvailableBlocks[blockIndex % shuffledAvailableBlocks.length];
            
            if (blockCounts[blockIdx] < blockCapacity) {
                console.log(`  Placing 1 remaining sample in block index: ${blockIdx}`);
                blockAssignments.get(blockIdx)!.push(remainingSamples[sampleIndex]);
                blockCounts[blockIdx]++;
                sampleIndex++;
            } else {
                // Remove this block from available blocks if it's at capacity
                shuffledAvailableBlocks.splice(blockIndex % shuffledAvailableBlocks.length, 1);
                if (shuffledAvailableBlocks.length === 0) break;
                blockIndex = blockIndex % shuffledAvailableBlocks.length;
                continue;
            }
            
            blockIndex = (blockIndex + 1) % shuffledAvailableBlocks.length;
        }
        
        if (sampleIndex < remainingSamples.length) {
            console.error(`Phase 2 (Blocks): Failed to place ${remainingSamples.length - sampleIndex} remaining samples from group ${groupKey}`);
        }
    });
    
    return blockAssignments;
}

function distributeToBlocksWithCapacities(
    covariateGroups: Map<string, SearchData[]>,
    plateCapacities: number[]
): Map<number, SearchData[]> {
    const numPlates = plateCapacities.length;
    const blockAssignments = new Map<number, SearchData[]>();
    const blockCounts = new Array(numPlates).fill(0);
    
    // Initialize block assignments
    for (let i = 0; i < numPlates; i++) {
        blockAssignments.set(i, []);
    }
    
    // Calculate total samples and verify we have enough capacity
    const totalSamples = Array.from(covariateGroups.values()).reduce((sum, samples) => sum + samples.length, 0);
    const totalCapacity = plateCapacities.reduce((sum, capacity) => sum + capacity, 0);
    
    console.log(`Plate capacities: ${plateCapacities.join(', ')}; Sample count: ${totalSamples}`);

    if (totalSamples > totalCapacity) {
        console.error(`Not enough capacity: ${totalSamples} samples > ${totalCapacity} total capacity`);
        return blockAssignments;
    }
    
    // Store remaining samples for Phase 2
    const unplacedGroupsMap = new Map<string, SearchData[]>(); // Groups with no Phase 1 placement
    const overflowSamplesMap = new Map<string, SearchData[]>(); // Groups with Phase 1 overflow

    // PHASE 1: Place minimum required samples from ALL covariate groups
    // Calculate minimum samples per full plate (only consider full capacity plates)
    const fullPlatesCount = plateCapacities.filter(capacity => capacity === 96).length;
    const effectivePlatesForMinimum = fullPlatesCount > 0 ? fullPlatesCount : numPlates;

    covariateGroups.forEach((samples, groupKey) => {
        const shuffledSamples = shuffleArray([...samples]);
        const totalGroupSamples = shuffledSamples.length;
        const baseSamplesPerPlate = Math.floor(totalGroupSamples / numPlates);

        let sampleIndex = 0;

        console.log(`Phase 1: Minimum required samples for group ${groupKey} (${totalGroupSamples}/${numPlates}): ${baseSamplesPerPlate}`);

        // Place minimum required samples in full plates only (capacity 96)
        if (baseSamplesPerPlate > 0) {
            let fullPlatesProcessed = 0;
            for (let plateIdx = 0; plateIdx < numPlates && fullPlatesProcessed < fullPlatesCount; plateIdx++) {
                // Only place in full capacity plates during Phase 1
                if (plateCapacities[plateIdx] < 96) continue;

                fullPlatesProcessed++;
                console.log(`  Placing minimum required samples in plate index ${plateIdx}`);

                // Check if we have capacity for the minimum required samples
                const availableCapacity = plateCapacities[plateIdx] - blockCounts[plateIdx];
                const samplesToPlace = Math.min(baseSamplesPerPlate, availableCapacity);

                if (samplesToPlace < baseSamplesPerPlate) {
                    console.error(`Phase 1 (Plates): Plate ${plateIdx} cannot accommodate minimum ${baseSamplesPerPlate} samples for group ${groupKey}. Only ${samplesToPlace} can be placed.`);
                }

                // Place the guaranteed minimum samples
                for (let i = 0; i < samplesToPlace && sampleIndex < shuffledSamples.length; i++) {
                    blockAssignments.get(plateIdx)!.push(shuffledSamples[sampleIndex++]);
                    blockCounts[plateIdx]++;
                }
            }
        }

        // Store any remaining samples for Phase 2
        if (sampleIndex < shuffledSamples.length) {
            const remainingSamples = shuffledSamples.slice(sampleIndex);
            if (baseSamplesPerPlate === 0) {
                // Group had no placement in Phase 1 (fewer samples than plates)
                unplacedGroupsMap.set(groupKey, remainingSamples);
            } else {
                // Group had some placement in Phase 1, these are overflow samples
                overflowSamplesMap.set(groupKey, remainingSamples);
            }
        }
    });

    // PHASE 2: Distribute remaining samples across all plates (including partial plates)
    // First process unplaced groups (priority), then overflow samples
    const sortedUnplacedGroups = Array.from(unplacedGroupsMap.entries())
        .sort(([, samplesA], [, samplesB]) => samplesB.length - samplesA.length);
    
    const sortedOverflowGroups = Array.from(overflowSamplesMap.entries())
        .sort(([, samplesA], [, samplesB]) => samplesB.length - samplesA.length);
    
    // Combine: unplaced groups first, then overflow groups
    const allSortedGroups = [...sortedUnplacedGroups, ...sortedOverflowGroups];

    allSortedGroups.forEach(([groupKey, remainingSamples]) => {
        console.log(`Phase 2: Remaining samples for group ${groupKey}: ${remainingSamples.length}`);

        // Get plates with available capacity
        const availablePlates = [];
        for (let plateIdx = 0; plateIdx < numPlates; plateIdx++) {
            const availableCapacity = plateCapacities[plateIdx] - blockCounts[plateIdx];
            if (availableCapacity > 0) {
                console.log(`  Plate is available. Index: ${plateIdx}; Capacity: ${availableCapacity}`);
                availablePlates.push(plateIdx);
            }
        }

        if (availablePlates.length === 0) {
            console.error(`Phase 2 (Plates): No available capacity for remaining samples from group ${groupKey}`);
            return;
        }

        // Shuffle available plates for random distribution
        const shuffledAvailablePlates = shuffleArray([...availablePlates]);

        // Distribute remaining samples from this group across available plates
        let sampleIndex = 0;
        let plateIndex = 0;

        while (sampleIndex < remainingSamples.length && shuffledAvailablePlates.length > 0) {
            const plateIdx = shuffledAvailablePlates[plateIndex % shuffledAvailablePlates.length];

            if (blockCounts[plateIdx] < plateCapacities[plateIdx]) {
                console.log(`  Placing 1 remaining sample in plate index: ${plateIdx}`);
                blockAssignments.get(plateIdx)!.push(remainingSamples[sampleIndex]);
                blockCounts[plateIdx]++;
                sampleIndex++;
            } else {
                // Remove this plate from available plates if it's at capacity
                shuffledAvailablePlates.splice(plateIndex % shuffledAvailablePlates.length, 1);
                if (shuffledAvailablePlates.length === 0) break;
                plateIndex = plateIndex % shuffledAvailablePlates.length;
                continue;
            }

            plateIndex = (plateIndex + 1) % shuffledAvailablePlates.length;
        }

        if (sampleIndex < remainingSamples.length) {
            console.error(`Phase 2 (Plates): Failed to place ${remainingSamples.length - sampleIndex} remaining samples from group ${groupKey}`);
        }
    });

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
    
    let actualPlatesNeeded: number;
    let plateCapacities: number[];
    
    if (keepEmptyInLastPlate) {
        // Calculate optimal number of plates to minimize empty spots
        const platesNeeded = Math.ceil(totalSamples / 96);
        
        // Calculate how many plates should be completely filled
        const fullPlates = Math.floor(totalSamples / 96);
        const remainingSamples = totalSamples % 96;

        // Determine actual plates to use and their capacities
        actualPlatesNeeded = remainingSamples > 0 ? fullPlates + 1 : fullPlates;
        plateCapacities = Array(actualPlatesNeeded).fill(96);

        // If there are remaining samples, the last plate gets only those samples
        if (remainingSamples > 0) {
            plateCapacities[plateCapacities.length - 1] = remainingSamples;
        }
    } else {
        // Original behavior: distribute evenly across all plates
        actualPlatesNeeded = Math.ceil(totalSamples / 96);
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