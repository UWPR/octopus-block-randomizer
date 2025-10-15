export interface SearchData {
    name: string;
    metadata: { [key: string]: string };
}
export type RandomizationAlgorithm = 'balanced' | 'balanced_spatial' | 'greedy';

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
export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export interface PlateQualityScore {
  plateIndex: number;
  balanceScore: number; // 0-100 (Proportional Accuracy)
  randomizationScore: number; // 0-100 (Spatial Clustering)
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
  averageRandomizationScore: number; // 0-100
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