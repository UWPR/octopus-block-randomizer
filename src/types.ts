export interface SearchData {
    name: string;
    metadata: { [key: string]: string };
}
export type RandomizationAlgorithm = 'balanced' | 'greedy';

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

// Simplified Quality Metrics Types
export interface PlateQualityScore {
  plateIndex: number;
  balanceScore: number; // 0-100 (Proportional Accuracy)
  randomizationScore: number; // 0-100 (Spatial Clustering)
  overallScore: number; // 0-100 (Average of both)
}

export interface PlateDiversityMetrics {
  averageBalanceScore: number; // 0-100
  averageRandomizationScore: number; // 0-100
  plateScores: PlateQualityScore[];
}

export interface OverallQualityAssessment {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

export interface QualityMetrics {
  plateDiversity: PlateDiversityMetrics;
  overallQuality: OverallQualityAssessment;
}



export interface DistributionAnalysis {
  expected: { [key: string]: number };
  actual: { [key: string]: number };
  plateDistributions: { [plateIndex: number]: { [key: string]: number } };
}