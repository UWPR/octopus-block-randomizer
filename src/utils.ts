import { SearchData, RandomizationAlgorithm } from './types';
import Papa from 'papaparse';
import { balancedBlockRandomization } from './algorithms/balancedRandomization';
import { greedyRandomization } from './algorithms/greedyRandomization';

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

// Algorithm descriptions for UI
export const ALGORITHM_DESCRIPTIONS = {
  balanced: 'Balanced Block Randomization - Proportional distribution across plates and within plate rows',
  greedy: 'Greedy Randomization'
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
            return greedyRandomization(searches, selectedCovariates);
    }
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