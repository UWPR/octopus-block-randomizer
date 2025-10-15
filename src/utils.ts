import { SearchData, RandomizationAlgorithm, QualityLevel } from './types';
import Papa from 'papaparse';
import { balancedBlockRandomization, balancedSpatialRandomization } from './algorithms/balancedRandomization';
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
        case 'balanced_spatial':
            return balancedSpatialRandomization(searches, selectedCovariates, keepEmptyInLastPlate, numRows, numColumns);
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
/**

 * Get color for quality score based on standardized thresholds
 * @param score - Quality score (0-100)
 * @returns Hex color code
 */
export const getQualityColor = (score: number): string => {
  return getQualityLevelColor(getQualityLevel(score));
};

/**
 * Get color for quality level string
 * @param level - Quality level ('excellent', 'good', 'fair', 'poor', 'bad')
 * @returns Hex color code
 */
export const getQualityLevelColor = (level: QualityLevel): string => {
  switch (level) {
    case 'excellent': return '#4caf50';      // Green
    case 'good': return '#9ACD32';           // Greenish Yellow
    case 'fair': return '#ff9800';          // Orange
    case 'poor': return '#D2691E';          // Red
    case 'bad': return '#f44336';           // Dark Red
    default: return '#666';                 // Gray
  }
};

/**
 * Get quality level for a given score
 * @param score - Quality score (0-100)
 * @returns Quality level
 */
export const getQualityLevel = (score: number): QualityLevel => {
  // Round to 1 decimal place to match display formatting
  const roundedScore = Math.round(score * 10) / 10;

  if (roundedScore >= 90) return 'excellent';
  if (roundedScore >= 80) return 'good';
  if (roundedScore >= 70) return 'fair';
  if (roundedScore >= 60) return 'poor';
  return 'bad';
};

/**
 * Format a quality score for display with consistent decimal precision
 * @param score - Quality score (0-100)
 * @returns Formatted score string with 1 decimal place
 */
export const formatScore = (score: number): string => {
  return score.toFixed(1);
};

/**
 * Get compact quality level (first letter) for a given score
 * @param score - Quality score (0-100)
 * @returns Single uppercase letter representing quality level
 */
export const getCompactQualityLevel = (score: number): string => {
  return getQualityLevel(score).charAt(0).toUpperCase();
};

/**
 * Get compact quality level from quality level string
 * @param level - Quality level string
 * @returns Single uppercase letter representing quality level
 */
export const getCompactQualityLevelFromString = (level: QualityLevel): string => {
  return level.charAt(0).toUpperCase();
};

/**
 * Get full quality level name (capitalized) for a given score
 * @param score - Quality score (0-100)
 * @returns Capitalized quality level name
 */
export const getFullQualityLevel = (score: number): string => {
  const level = getQualityLevel(score);
  return level.charAt(0).toUpperCase() + level.slice(1);
};

/**
 * Get full quality level name from quality level string
 * @param level - Quality level string
 * @returns Capitalized quality level name
 */
export const getFullQualityLevelFromString = (level: QualityLevel): string => {
  return level.charAt(0).toUpperCase() + level.slice(1);
};