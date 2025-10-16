import { SearchData, RandomizationAlgorithm, QualityLevel, QUALITY_LEVEL_CONFIG } from './types';
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

// Spatial neighbor utility functions
export interface NeighborPosition {
  row: number;
  col: number;
}

/**
 * Get all valid 8-connected neighbors of a cell in a plate
 * @param row - Current row position
 * @param col - Current column position
 * @param numRows - Total number of rows in the plate
 * @param numCols - Total number of columns in the plate
 * @returns Array of valid neighbor positions
 */
export function getNeighborPositions(
  row: number,
  col: number,
  numRows: number,
  numCols: number
): NeighborPosition[] {
  const neighbors: NeighborPosition[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue; // Skip self

      const newRow = row + dr;
      const newCol = col + dc;

      if (newRow >= 0 && newRow < numRows && newCol >= 0 && newCol < numCols) {
        neighbors.push({ row: newRow, col: newCol });
      }
    }
  }

  return neighbors;
}

/**
 * Get neighbor analysis for spatial quality metrics
 * @param plate - 2D array representing the plate
 * @param row - Current row position  
 * @param col - Current column position
 * @param sampleKey - The covariate key to compare neighbors against
 * @param selectedCovariates - Array of selected covariate names
 * @returns Object with similar and total neighbor counts
 */
export function analyzeNeighbors<T extends SearchData | undefined>(
  plate: T[][],
  row: number,
  col: number,
  sampleKey: string,
  selectedCovariates: string[]
): { similarNeighbors: number; totalNeighbors: number; differentNeighbors: number } {
  const neighbors = getNeighborPositions(row, col, plate.length, plate[0]?.length || 0);

  let similarNeighbors = 0;
  let totalNeighbors = 0;

  for (const neighbor of neighbors) {
    const neighborSample = plate[neighbor.row][neighbor.col];
    if (neighborSample) {
      totalNeighbors++;
      const neighborKey = getCovariateKey(neighborSample, selectedCovariates);
      if (sampleKey === neighborKey) {
        similarNeighbors++;
      }
    }
  }

  const differentNeighbors = totalNeighbors - similarNeighbors;
  return { similarNeighbors, totalNeighbors, differentNeighbors };
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
 * Get full quality level name (capitalized) for a given score
 * @param score - Quality score (0-100)
 * @returns Capitalized quality level name
 */
export const getFullQualityLevel = (score: number): string => {
  return getFullQualityLevelFromString(getQualityLevel(score));
};

/**
 * Get full quality level name from quality level string
 * @param level - Quality level string
 * @returns Capitalized quality level name
 */
export const getFullQualityLevelFromString = (level: QualityLevel): string => {
  return QUALITY_LEVEL_CONFIG[level].name;
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

/**
 * Get quality levels sorted by score threshold (best to worst)
 * @returns Array of quality level keys sorted by descending lowScore
 */
export const getQualityLevelsByScore = (): QualityLevel[] => {
  return QUALITY_LEVELS_BY_SCORE.map(([levelKey]) => levelKey as QualityLevel);
};