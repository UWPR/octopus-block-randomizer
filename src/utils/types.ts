import { ALGORITHM_CONFIG, QUALITY_LEVEL_CONFIG, QualityLevel, isDeveloperMode } from './configs';

// Block types for distribution algorithms
export enum BlockType {
  PLATE = 'Plate',
  ROW = 'Row'
}

// Base search data from CSV (before covariate selection)
export interface SearchData {
  name: string;
  metadata: { [key: string]: string };
  treatmentKey?: string;  // Covariate combination key, calculated based on selected covariates
}

export type RandomizationAlgorithm = keyof typeof ALGORITHM_CONFIG;

// Utility functions for algorithm configuration
export const getAlgorithmName = (algorithm: RandomizationAlgorithm): string =>
  ALGORITHM_CONFIG[algorithm].name;

export const getAlgorithmDescription = (algorithm: RandomizationAlgorithm): string =>
  ALGORITHM_CONFIG[algorithm].description;

export const getAllAlgorithms = (): RandomizationAlgorithm[] =>
  Object.keys(ALGORITHM_CONFIG) as RandomizationAlgorithm[];

// Get algorithms in UI display order
export const getAlgorithmsInDisplayOrder = (): RandomizationAlgorithm[] => {
  const algorithms: RandomizationAlgorithm[] = ['balanced'];
  
  // Show all algorithms in developer mode, otherwise show only the base algorithm
  if (isDeveloperMode()) {
    return ['balanced', 'greedy'] as RandomizationAlgorithm[];
  }
  
  return algorithms;
};

export interface RandomizationOptions {
  algorithm: RandomizationAlgorithm;
  selectedCovariates: string[];
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
  textColor: string; // Pre-calculated text color for readability (white or black)
}

// Quality Metrics Levels
export interface QualityLevelConfig {
  name: string;
  shortLabel: string;
  color: string;
  lowScore: number;
  highScore: number;
}

// Utility functions for quality levels
export const getQualityLevelConfig = (level: QualityLevel): QualityLevelConfig =>
  QUALITY_LEVEL_CONFIG[level];

export const getAllQualityLevelKeys = (): QualityLevel[] =>
  Object.keys(QUALITY_LEVEL_CONFIG) as QualityLevel[];

export interface PlateQualityScore {
  plateIndex: number;
  balanceScore: number; // 0-100 (Proportional Accuracy)
  rowClusteringScore: number; // 0-100 (Row Clustering)
  overallScore: number; // 0-100 (Average of both)
  rowScores?: number[]; // Individual row scores (0-100)
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

