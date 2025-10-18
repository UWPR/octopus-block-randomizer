export interface SearchData {
  name: string;
  metadata: { [key: string]: string };
}

// Algorithm configuration with descriptions
export const ALGORITHM_CONFIG = {
  balanced: {
    name: 'Balanced Block Randomization',
    description: 'Proportional distribution across plates and within plate rows'
  },
  greedy: {
    name: 'Greedy Randomization',
    description: 'Greedy Randomization'
  }
} as const;

export type RandomizationAlgorithm = keyof typeof ALGORITHM_CONFIG;

// Utility functions for algorithm configuration
export const getAlgorithmName = (algorithm: RandomizationAlgorithm): string =>
  ALGORITHM_CONFIG[algorithm].name;

export const getAlgorithmDescription = (algorithm: RandomizationAlgorithm): string =>
  ALGORITHM_CONFIG[algorithm].description;

export const getAllAlgorithms = (): RandomizationAlgorithm[] =>
  Object.keys(ALGORITHM_CONFIG) as RandomizationAlgorithm[];

// Get algorithms in UI display order
export const getAlgorithmsInDisplayOrder = (): RandomizationAlgorithm[] =>
  ['balanced', 'greedy'] as RandomizationAlgorithm[];

export interface RandomizationOptions {
  algorithm: RandomizationAlgorithm;
  selectedCovariates: string[];
  // Additional options for future algorithms
  maxIterations?: number;
  balanceWeight?: number;
}

export interface SummaryItem {
  combination: string;
  values: { [key: string]: string };
  count: number;
  color: string;
  useOutline: boolean;
  useStripes: boolean;
}

export interface CovariateColorInfo {
  color: string;
  useOutline: boolean;
  useStripes: boolean;
}

// Quality Metrics Levels
export interface QualityLevelConfig {
  name: string;
  shortLabel: string;
  color: string;
  lowScore: number;
  highScore: number;
}

export const QUALITY_LEVEL_CONFIG = {
  excellent: {
    name: 'Excellent',
    shortLabel: 'E',
    color: '#4caf50',      // Green
    lowScore: 90,
    highScore: 100
  },
  good: {
    name: 'Good',
    shortLabel: 'G',
    color: '#9ACD32',      // Greenish Yellow
    lowScore: 80,
    highScore: 89
  },
  fair: {
    name: 'Fair',
    shortLabel: 'F',
    color: '#ff9800',      // Orange
    lowScore: 70,
    highScore: 79
  },
  poor: {
    name: 'Poor',
    shortLabel: 'P',
    color: '#D2691E', // Chocolate
    lowScore: 60,
    highScore: 69
  },
  bad: {
    name: 'Bad',
    shortLabel: 'B',
    color: '#f44336',      // Red
    lowScore: 0,
    highScore: 59
  }
} as const;

export type QualityLevel = keyof typeof QUALITY_LEVEL_CONFIG;

// Utility functions for quality levels
export const getQualityLevelConfig = (level: QualityLevel): QualityLevelConfig =>
  QUALITY_LEVEL_CONFIG[level];

export const getAllQualityLevelKeys = (): QualityLevel[] =>
  Object.keys(QUALITY_LEVEL_CONFIG) as QualityLevel[];

export interface PlateQualityScore {
  plateIndex: number;
  balanceScore: number; // 0-100 (Proportional Accuracy)
  // randomizationScore: number; // 0-100 (Spatial Clustering)
  rowClusteringScore: number; // 0-100 (Row Clustering)
  overallScore: number; // 0-100 (Average of both)
  covariateGroupBalance: {
    [combination: string]: {
      actualCount: number;
      expectedCount: number;
      actualProportion: number;
      expectedProportion: number;
      relativeDeviation: number;
      weightedDeviation: number;
      balanceScore: number
    }
  };
}

export interface PlateDiversityMetrics {
  averageBalanceScore: number; // 0-100
  // averageRandomizationScore: number; // 0-100
  averageRowClusteringScore: number; // 0-100
  plateScores: PlateQualityScore[];
}

export interface OverallQualityAssessment {
  score: number; // 0-100
  level: QualityLevel;
  recommendations: string[];
}

export interface QualityMetrics {
  plateDiversity: PlateDiversityMetrics;
  overallQuality: OverallQualityAssessment;
}