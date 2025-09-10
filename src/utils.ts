import { SearchData, RandomizationAlgorithm } from './types';
import Papa from 'papaparse';

// Bright color palette with 24 distinct colors in 4 randomized subgroups
export const BRIGHT_COLOR_PALETTE = [
  // Subgroup 1
  '#FF69B4', // Hot Pink
  '#0000FF', // Pure Blue
  '#FF8000', // Pure Orange
  '#9370DB', // Medium Purple
  '#006400', // Dark Forest Green
  '#008B8B', // Dark Cyan

  // Subgroup 2
  '#FF0000', // Pure Red
  '#87CEEB', // Sky Blue
  '#800080', // Purple
  '#FF1493', // Deep Pink
  '#32CD32', // Lime Green
  '#C0C0C0', // Silver

  // Subgroup 3
  '#F08080', // Light Coral
  '#4169E1', // Royal Blue
  '#FFA500', // Orange
  '#FFFF00', // Pure Yellow
  '#98FB98', // Pale Green
  '#40E0D0', // Turquoise

  // Subgroup 4
  '#FF4500', // Orange Red
  '#8000FF', // Pure Purple
  '#BA55D3', // Medium Orchid
  '#B8860B', // Dark Gold
  '#20B2AA', // Light Sea Green
  '#DDA0DD'  // Plum
];

// Algorithm descriptions for UI
export const ALGORITHM_DESCRIPTIONS = {
  greedy: 'Greedy Randomization - Fast assignment with basic covariate balancing',
  optimized: 'Optimized Block Randomization - Proportional distribution with within-row balancing',
  latin_square: 'Latin Square Design - Systematic positional balance (works best with fewer groups)'
};

// Utility functions
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getCovariateKey(search: SearchData, selectedCovariates: string[]): string {
    return selectedCovariates
        .map(cov => search.metadata[cov] || 'N/A')
        .join('|');
}

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

// Main randomization function with algorithm selection
export function randomizeSearches(
    searches: SearchData[], 
    selectedCovariates: string[], 
    algorithm: RandomizationAlgorithm = 'greedy'
): (SearchData | undefined)[][][] {
    switch (algorithm) {
        case 'optimized':
            return optimizedBlockRandomizationWithValidation(searches, selectedCovariates);
        case 'latin_square':
            return latinSquareRandomization(searches, selectedCovariates);
        case 'greedy':
        default:
            return greedyRandomization(searches, selectedCovariates);
    }
}

// Original greedy algorithm (refactored)
function greedyRandomization(searches: SearchData[], selectedCovariates: string[]): (SearchData | undefined)[][][] {
    const platesNeeded = Math.ceil(searches.length / 96);
    let plates = Array.from({ length: platesNeeded }, () =>
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
    );

    let shuffledSearches = shuffleArray([...searches]);

    function searchCanBePlaced(search: SearchData, row: (SearchData | undefined)[], tolerance: number): boolean {
        const searchCovariates = selectedCovariates.map(cov => search.metadata[cov]);
        let duplicateCount = 0;

        for (const existingSearch of row) {
            if (existingSearch === undefined) continue;
            const existingSearchCovariates = selectedCovariates.map(cov => existingSearch.metadata[cov]);
            if (JSON.stringify(searchCovariates) === JSON.stringify(existingSearchCovariates)) {
                duplicateCount++;
            }
        }

        return duplicateCount <= tolerance;
    }

    // Place searches with increasing tolerance
    for (const search of shuffledSearches) {
        let placed = false;
        let tolerance = 0;

        while (!placed) {
            for (let p = 0; p < plates.length && !placed; p++) {
                for (let r = 0; r < plates[p].length && !placed; r++) {
                    if (searchCanBePlaced(search, plates[p][r], tolerance) && plates[p][r].includes(undefined)) {
                        const indexToPlace = plates[p][r].indexOf(undefined);
                        plates[p][r][indexToPlace] = search;
                        placed = true;
                    }
                }
            }

            if (!placed) tolerance++;
        }
    }

    //maximizeDissimilarity(plates, selectedCovariates);

    // Shuffle the order of searches within each row after all searches have been assigned
    for (let p = 0; p < plates.length; p++) {
        for (let r = 0; r < plates[p].length; r++) {
            plates[p][r] = shuffleArray(plates[p][r]);
        }
    }

    return plates;
}

// New optimized block randomization algorithm
function optimizedBlockRandomization(searches: SearchData[], selectedCovariates: string[]): (SearchData | undefined)[][][] {
    const platesNeeded = Math.ceil(searches.length / 96);
    const plates = Array.from({ length: platesNeeded }, () =>
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
    );

    // STEP 1: Group samples by covariate combinations
    const covariateGroups = groupByCovariates(searches, selectedCovariates);
    
    // STEP 2: Distribute samples across plates using utility function
    const plateAssignments = distributeToBlocks(covariateGroups, platesNeeded, 96);
    
    // STEP 3: Verify complete assignment
    let totalAssigned = 0;
    plateAssignments.forEach(samples => totalAssigned += samples.length);
    
    if (totalAssigned !== searches.length) {
        console.error(`Sample assignment error: ${totalAssigned} assigned vs ${searches.length} total`);
        console.log('Plate counts:', Array.from(plateAssignments.values()).map(samples => samples.length));
    }

    // STEP 4: For each plate, distribute samples across rows using the same utility function
    plateAssignments.forEach((plateSamples, plateIdx) => {
        // Group samples by covariates for this plate
        const plateGroups = groupByCovariates(plateSamples, selectedCovariates);
        
        // Calculate how many rows we need for this plate
        const totalPlateSamples = plateSamples.length;
        const rowsNeeded = Math.ceil(totalPlateSamples / 12);
        const actualRowsToUse = Math.min(rowsNeeded, 8); // Max 8 rows available
        
        // Distribute samples across rows using utility function
        const rowAssignments = distributeToBlocks(plateGroups, actualRowsToUse, 12);
        
        // STEP 5: Fill the actual plate positions and shuffle within rows
        rowAssignments.forEach((rowSamples, rowIdx) => {
            if (rowIdx < 8) { // Only fill the 8 available rows
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

// Enhanced optimized block randomization with validation
function optimizedBlockRandomizationWithValidation(
    searches: SearchData[], 
    selectedCovariates: string[]
): (SearchData | undefined)[][][] {
    const platesNeeded = Math.ceil(searches.length / 96);
    const plates = Array.from({ length: platesNeeded }, () =>
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
    );

    // STEP 1: Group samples by covariate combinations
    const covariateGroups = groupByCovariates(searches, selectedCovariates);
    
    // STEP 2: Calculate expected minimums for validation
    const expectedMinimums: { [groupKey: string]: number } = {};
    covariateGroups.forEach((samples, groupKey) => {
        expectedMinimums[groupKey] = Math.floor(samples.length / platesNeeded);
    });
    
    // STEP 3: Distribute samples across plates using fixed utility function
    const plateAssignments = distributeToBlocks(covariateGroups, platesNeeded, 96);
    
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
        
        // Distribute samples across rows using fixed utility function
        const totalPlateSamples = plateSamples.length;
        const rowsNeeded = Math.ceil(totalPlateSamples / 12);
        const actualRowsToUse = Math.min(rowsNeeded, 8);
        
        const rowAssignments = distributeToBlocks(plateGroups, actualRowsToUse, 12);
        
        // Validate row-level distribution
        const rowDistributionValid = validateDistribution(rowAssignments, selectedCovariates, rowMinimums, 'plate ${plateIdx + 1} row');
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

// Debug function to analyze distribution
function analyzeDistribution(
    plates: (SearchData | undefined)[][][],
    selectedCovariates: string[]
): void {
    console.log("=== DISTRIBUTION ANALYSIS ===");
    
    plates.forEach((plate, plateIdx) => {
        console.log(`\nPlate ${plateIdx + 1}:`);
        
        // Count by covariate groups for this plate
        const plateGroupCounts = new Map<string, number>();
        
        plate.forEach((row, rowIdx) => {
            const rowGroupCounts = new Map<string, number>();
            
            row.forEach(sample => {
                if (sample) {
                    const groupKey = getCovariateKey(sample, selectedCovariates);
                    
                    // Update plate counts
                    plateGroupCounts.set(groupKey, (plateGroupCounts.get(groupKey) || 0) + 1);
                    
                    // Update row counts
                    rowGroupCounts.set(groupKey, (rowGroupCounts.get(groupKey) || 0) + 1);
                }
            });
            
            // Log row distribution
            const rowCounts = Array.from(rowGroupCounts.entries())
                .map(([group, count]) => `${group}: ${count}`)
                .join(", ");
            console.log(`  Row ${String.fromCharCode(65 + rowIdx)}: ${rowCounts}`);
        });
        
        // Log plate totals
        const plateCounts = Array.from(plateGroupCounts.entries())
            .map(([group, count]) => `${group}: ${count}`)
            .join(", ");
        console.log(`  Plate total: ${plateCounts}`);
    });
}

// Latin Square-inspired randomization
function latinSquareRandomization(searches: SearchData[], selectedCovariates: string[]): (SearchData | undefined)[][][] {
    const platesNeeded = Math.ceil(searches.length / 96);
    const plates = Array.from({ length: platesNeeded }, () =>
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
    );

    // Group samples by covariate combinations
    const covariateGroups = groupByCovariates(searches, selectedCovariates);
    const groupKeys = Array.from(covariateGroups.keys());
    const numGroups = groupKeys.length;

    // If we have 8 or fewer groups, we can use a true Latin square approach for rows
    // If we have 12 or fewer groups, we can use it for columns
    const useRowLatinSquare = numGroups <= 8;
    const useColLatinSquare = numGroups <= 12;

    for (let plateIdx = 0; plateIdx < platesNeeded; plateIdx++) {
        if (useRowLatinSquare && useColLatinSquare) {
            // Perfect Latin square: each group appears once per row and column
            assignWithFullLatinSquare(plates[plateIdx], covariateGroups, groupKeys, plateIdx);
        } else if (useRowLatinSquare) {
            // Row-based Latin square: each group appears once per row
            assignWithRowLatinSquare(plates[plateIdx], covariateGroups, groupKeys, plateIdx);
        } else {
            // Fallback to systematic distribution with position cycling
            assignWithSystematicDistribution(plates[plateIdx], covariateGroups, groupKeys, plateIdx);
        }
    }

    return plates;
}

function assignWithFullLatinSquare(
    plate: (SearchData | undefined)[][],
    covariateGroups: Map<string, SearchData[]>,
    groupKeys: string[],
    plateIdx: number
): void {
    const numGroups = groupKeys.length;
    
    // Create Latin square pattern
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 12; col++) {
            if (row < numGroups && col < numGroups) {
                // Latin square assignment
                const groupIndex = (row + col * plateIdx) % numGroups;
                const groupKey = groupKeys[groupIndex];
                const groupSamples = covariateGroups.get(groupKey) || [];
                
                if (groupSamples.length > 0) {
                    const sampleIndex = Math.floor(Math.random() * groupSamples.length);
                    plate[row][col] = groupSamples.splice(sampleIndex, 1)[0];
                }
            }
        }
    }
    
    // Fill remaining positions with available samples
    fillRemainingPositions(plate, covariateGroups);
}

function assignWithRowLatinSquare(
    plate: (SearchData | undefined)[][],
    covariateGroups: Map<string, SearchData[]>,
    groupKeys: string[],
    plateIdx: number
): void {
    const numGroups = groupKeys.length;
    
    // Ensure each group appears once per row
    for (let row = 0; row < 8; row++) {
        const shuffledGroups = shuffleArray([...groupKeys]);
        
        for (let i = 0; i < Math.min(12, numGroups); i++) {
            const groupKey = shuffledGroups[i];
            const groupSamples = covariateGroups.get(groupKey) || [];
            
            if (groupSamples.length > 0) {
                const sampleIndex = Math.floor(Math.random() * groupSamples.length);
                plate[row][i] = groupSamples.splice(sampleIndex, 1)[0];
            }
        }
    }
    
    fillRemainingPositions(plate, covariateGroups);
}

function assignWithSystematicDistribution(
    plate: (SearchData | undefined)[][],
    covariateGroups: Map<string, SearchData[]>,
    groupKeys: string[],
    plateIdx: number
): void {
    const allSamples: SearchData[] = [];
    covariateGroups.forEach(samples => allSamples.push(...samples));
    
    const shuffledSamples = shuffleArray(allSamples);
    let sampleIndex = 0;
    
    // Systematic distribution across positions
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 12; col++) {
            if (sampleIndex < shuffledSamples.length) {
                plate[row][col] = shuffledSamples[sampleIndex++];
            }
        }
    }
}

function fillRemainingPositions(
    plate: (SearchData | undefined)[][],
    covariateGroups: Map<string, SearchData[]>
): void {
    // Collect all remaining samples
    const remainingSamples: SearchData[] = [];
    covariateGroups.forEach(samples => remainingSamples.push(...samples));
    
    const shuffledRemaining = shuffleArray(remainingSamples);
    let sampleIndex = 0;
    
    // Fill empty positions
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 12; col++) {
            if (plate[row][col] === undefined && sampleIndex < shuffledRemaining.length) {
                plate[row][col] = shuffledRemaining[sampleIndex++];
            }
        }
    }
}

// Legacy functions for backward compatibility
function generatePermutations(array: SearchData[]): (SearchData | undefined)[][] {
    if (array.length <= 1) return [array];
    const perms: (SearchData | undefined)[][] = [];
    const [first, ...rest] = array;
    for (const perm of generatePermutations(rest)) {
      for (let i = 0; i <= perm.length; i++) {
        const start = perm.slice(0, i);
        const end = perm.slice(i);
        perms.push([...start, first, ...end]);
      }
    }
    return perms;
}
  
function calculateDissimilarityScore(row: (SearchData | undefined)[], orderedRows: (SearchData | undefined)[][], selectedCovariates: string[]): number {
    let score = 0;
    for (let i = 0; i < row.length; i++) {
      orderedRows.forEach((orderedRow: (SearchData | undefined)[]) => {
        if (i < orderedRow.length && row[i] && orderedRow[i]) {
          const dissimilarity = selectedCovariates.some(covariate => 
            row[i]!.metadata[covariate] !== orderedRow[i]!.metadata[covariate]);
          if (dissimilarity) score++;
        }
      });
    }
    return score;
}

function maximizeDissimilarity(plates: (SearchData | undefined)[][][], selectedCovariates: string[]): void {
    plates.forEach((plate: (SearchData | undefined)[][]) => {
      let orderedRows: (SearchData | undefined)[][] = [];
  
      const startIndex = Math.floor(Math.random() * plate.length);
      orderedRows.push(...plate.splice(startIndex, 1));
  
      while (plate.length > 0) {
        let bestScore = -Infinity;
        let bestRow: (SearchData | undefined)[] | null = null;
        let bestRowIndex = -1;
  
        plate.forEach((row: (SearchData | undefined)[], rowIndex: number) => {
          const permutations = generatePermutations(row.filter(item => item !== undefined) as SearchData[]);
          permutations.forEach(permutation => {
            const score = calculateDissimilarityScore(permutation, orderedRows, selectedCovariates);
            if (score > bestScore) {
              bestScore = score;
              bestRow = permutation;
              bestRowIndex = rowIndex;
            }
          });
        });
  
        if (bestRow !== null) {
          orderedRows.push(bestRow);
          plate.splice(bestRowIndex, 1);
        }
      }
  
      plate.push(...orderedRows.map(row => [...row, ...Array(12 - row.length).fill(undefined)]));
    });
}

// Updated to accept referenceColumn parameter instead of hardcoding "search name"
export function downloadCSV(searches: SearchData[], randomizedPlates: (SearchData | undefined)[][][], referenceColumn: string) {
    const csv = Papa.unparse(
      searches.map((search) => ({
        [referenceColumn]: search.name, // Use the selected reference column name
        ...search.metadata,
        plate: getPlateNumber(search.name, randomizedPlates),
        row: getRowName(search.name, randomizedPlates),
        column: getColumnNumber(search.name, randomizedPlates),
      })),
      { header: true }
    );
  
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'randomized_searches.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function getPlateNumber(searchName: string, randomizedPlates: (SearchData | undefined)[][][]) {
    for (let plateIndex = 0; plateIndex < randomizedPlates.length; plateIndex++) {
      const plate = randomizedPlates[plateIndex];
      for (let rowIndex = 0; rowIndex < plate.length; rowIndex++) {
        const row = plate[rowIndex];
        if (row.find((search) => search?.name === searchName)) {
          return plateIndex + 1;
        }
      }
    }
    return '';
}

export function getRowName(searchName: string, randomizedPlates: (SearchData | undefined)[][][]) {
    for (let plateIndex = 0; plateIndex < randomizedPlates.length; plateIndex++) {
      const plate = randomizedPlates[plateIndex];
      for (let rowIndex = 0; rowIndex < plate.length; rowIndex++) {
        const row = plate[rowIndex];
        if (row.find((search) => search?.name === searchName)) {
          return String.fromCharCode(65 + rowIndex);
        }
      }
    }
    return '';
}

export function getColumnNumber(searchName: string, randomizedPlates: (SearchData | undefined)[][][]) {
    for (let plateIndex = 0; plateIndex < randomizedPlates.length; plateIndex++) {
      const plate = randomizedPlates[plateIndex];
      for (let rowIndex = 0; rowIndex < plate.length; rowIndex++) {
        const row = plate[rowIndex];
        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
          if (row[columnIndex]?.name === searchName) {
            return (columnIndex + 1).toString().padStart(2, '0');
          }
        }
      }
    }
    return '';
}