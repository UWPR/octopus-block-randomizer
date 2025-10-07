import { SearchData, RandomizationAlgorithm } from './types';
import Papa from 'papaparse';
import { balancedBlockRandomization } from './algorithms/blockRandomization';

// Bright color palette with 24 distinct colors in 4 randomized subgroups
export const BRIGHT_COLOR_PALETTE = [
    // Subgroup 1
    '#FF0000', // Pure Red
    '#0000FF', // Pure Blue
    '#32CD32', // Lime Green
    '#FF8000', // Pure Orange
    '#FFFF00', // Pure Yellow
    '#FF00FF', // Magenta

    // Subgroup 2
    '#87CEEB', // Sky Blue
    '#800080', // Purple
    '#FF1493', // Deep Pink
    '#006400', // Dark Forest Green
    '#4169E1', // Royal Blue
    '#20B2AA', // Light Sea Green


    // Subgroup 3
    '#F08080', // Light Coral
    '#40E0D0', // Turquoise
    '#FFA500', // Orange
    '#9370DB', // Medium Purple
    '#98FB98', // Pale Green
    '#C0C0C0', // Silver


    // Subgroup 4
    '#FF4500', // Orange Red
    '#8000FF', // Pure Purple
    '#BA55D3', // Medium Orchid
    '#B8860B', // Dark Gold
    '#008B8B', // Dark Cyan
    '#FF69B4', // Hot Pink
];

export interface CovariateColorInfo {
    color: string;
    useOutline: boolean;
    useStripes: boolean;
}

// Algorithm descriptions for UI
export const ALGORITHM_DESCRIPTIONS = {
    greedy: 'Greedy Randomization - Fast assignment with basic covariate balancing',
    balanced: 'Balanced Block Randomization - Proportional distribution with within-row balancing'
};

// Utility functions
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function getCovariateKey(search: SearchData, selectedCovariates: string[]): string {
    return selectedCovariates
        .map(cov => search.metadata[cov] || 'N/A')
        .join('|');
}

export function groupByCovariates(searches: SearchData[], selectedCovariates: string[]): Map<string, SearchData[]> {
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

// Main randomization function with algorithm selection
export function randomizeSearches(
    searches: SearchData[],
    selectedCovariates: string[],
    algorithm: RandomizationAlgorithm = 'balanced',
    keepEmptyInLastPlate: boolean = true,
    numRows: number = 8,
    numColumns: number = 12
): {
    plates: (SearchData | undefined)[][][];
    plateAssignments?: Map<number, SearchData[]>;
} {
    switch (algorithm) {
        case 'balanced':
            return balancedBlockRandomization(searches, selectedCovariates, keepEmptyInLastPlate, numRows, numColumns);
        case 'greedy':
        default:
            const greedyPlates = greedyRandomization(searches, selectedCovariates);
            return {
                plates: greedyPlates
            };
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

// Updated to accept idColumn parameter instead of hardcoding "search name"
export function downloadCSV(searches: SearchData[], randomizedPlates: (SearchData | undefined)[][][], idColumn: string) {
    const csv = Papa.unparse(
      searches.map((search) => ({
        [idColumn]: search.name, // Use the selected ID column name
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