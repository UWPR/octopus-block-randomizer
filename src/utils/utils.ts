import { SearchData, RandomizationAlgorithm } from './types';
import { QualityLevel, QUALITY_LEVEL_CONFIG } from './configs';
import Papa from 'papaparse';
import { balancedBlockRandomization } from '../algorithms/balancedRandomization';
import { greedyRandomization } from '../algorithms/greedyRandomization';

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

/**
 * Calculate appropriate text color (white or black) based on background color luminance
 * Uses WCAG formula for relative luminance calculation
 */
export function getTextColorForBackground(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using WCAG formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000' : '#fff';
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
  return QUALITY_LEVEL_CONFIG[level].color;
};

// Presorted quality levels by descending lowScore (highest to lowest) - computed once at module load
const QUALITY_LEVELS_BY_SCORE = Object.entries(QUALITY_LEVEL_CONFIG)
  .sort(([, a], [, b]) => b.lowScore - a.lowScore);

/**
 * Get quality level for a given score
 * @param score - Quality score (0-100)
 * @returns Quality level
 */
export const getQualityLevel = (score: number): QualityLevel => {
  // Round to 1 decimal place to match display formatting
  const roundedScore = Math.round(score * 10) / 10;

  // Find the first quality level where score >= lowScore
  for (const [levelKey, config] of QUALITY_LEVELS_BY_SCORE) {
    if (roundedScore >= config.lowScore) {
      return levelKey as QualityLevel;
    }
  }

  // Fallback to 'bad' if no match found (should never happen)
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
  return getCompactQualityLevelFromString(getQualityLevel(score));
};

/**
 * Get compact quality level from quality level string
 * @param level - Quality level string
 * @returns Single uppercase letter representing quality level
 */
export const getCompactQualityLevelFromString = (level: QualityLevel): string => {
  return QUALITY_LEVEL_CONFIG[level].shortLabel;
};

/**
 * Get all quality levels with their score ranges, badges, and descriptions
 * @returns Array of quality level information sorted by score (best to worst)
 */
export const getAllQualityLevels = () => {
  return QUALITY_LEVELS_BY_SCORE.map(([levelKey, config]) => ({
    range: `${config.lowScore}-${config.highScore}`,
    level: levelKey as QualityLevel,
    badge: config.shortLabel,
    description: config.name,
    color: config.color
  }));
};
