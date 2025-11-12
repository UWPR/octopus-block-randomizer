import { ALGORITHM_CONFIG, QUALITY_LEVEL_CONFIG, QualityLevel } from './configs';

// Block types for distribution algorithms
export enum BlockType {
  PLATE = 'Plate',
  ROW = 'Row'
}

export interface SearchData {
  name: string;
  metadata: { [key: string]: string };
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
export const getAlgorithmsInDisplayOrder = (): RandomizationAlgorithm[] =>
  ['balanced', 'greedy'] as RandomizationAlgorithm[];

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

// Repeated-measures interfaces

/**
 * Represents a group of samples from the same subject that must
 * stay together on the same plate
 */
export interface RepeatedMeasuresGroup {
  /** Unique identifier for this group (e.g., "Patient_001") */
  subjectId: string;

  /** All samples belonging to this group */
  samples: SearchData[];

  /**
   * Treatment composition of this group
   * Maps treatment combination key to count of samples
   * Example: {"Drug|Timepoint_0": 2, "Drug|Timepoint_10": 1}
   *
   * Note: A repeated-measures group can contain samples with
   * DIFFERENT treatment variable values (e.g., different timepoints)
   */
  treatmentComposition: Map<string, number>;

  /** Total number of samples in this group */
  size: number;

  /** Whether this is a singleton group (sample without subject ID) */
  isSingleton: boolean;
}

/**
 * Configuration for randomization with optional repeated-measures support
 */
export interface RandomizationConfig {
  /** Variables used for treatment balancing */
  treatmentVariables: string[];

  /** Variable used for repeated-measures grouping (optional) */
  repeatedMeasuresVariable?: string;

  /** Standard randomization parameters */
  keepEmptyInLastPlate: boolean;
  numRows: number;
  numColumns: number;
}

/**
 * Enhanced return type for randomization with repeated-measures metadata
 */
export interface RandomizationResult {
  /** 3D array: plates[plateIdx][rowIdx][colIdx] = SearchData | undefined */
  plates: (SearchData | undefined)[][][];

  /** Map of plate index to samples assigned to that plate */
  plateAssignments?: Map<number, SearchData[]>;

  /** Repeated-measures groups created (if applicable) */
  repeatedMeasuresGroups?: RepeatedMeasuresGroup[];

  /** Quality metrics for the randomization */
  qualityMetrics?: RepeatedMeasuresQualityMetrics;
}

/**
 * Quality metrics specific to repeated-measures randomization
 */
export interface RepeatedMeasuresQualityMetrics {
  /** Whether repeated-measures constraints are satisfied */
  repeatedMeasuresConstraintsSatisfied: boolean;

  /** Number of groups split across plates (should be 0) */
  repeatedMeasuresViolations: number;

  /** Treatment balance score (0-100, higher is better) */
  treatmentBalanceScore: number;

  /** Per-plate repeated-measures group counts */
  plateGroupCounts: number[];

  /** Distribution of group sizes */
  groupSizeDistribution: {
    singletons: number;
    small: number;    // 2-5 samples
    medium: number;   // 6-15 samples
    large: number;    // 16+ samples
  };

  /** Standard quality metrics */
  standardMetrics: QualityMetrics;
}

