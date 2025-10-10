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
export interface CovariateGroupMetric {
  sampleCount: number;
  cv: number;
  pValue: number;
  isSmallGroup: boolean;
  adjustedAssessment: 'good' | 'acceptable' | 'poor';
}

export interface PlateQualityScore {
  plateIndex: number;
  proportionalAccuracy: number; // 0-100
  entropy: number; // 0-100 normalized
}

export interface PlateDiversityMetrics {
  averageProportionalAccuracy: number; // 0-100
  averageEntropy: number; // 0-100 normalized
  plateScores: PlateQualityScore[];
}

export interface OverallQualityAssessment {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

export interface QualityMetrics {
  covariateGroups: { [combination: string]: CovariateGroupMetric };
  plateDiversity: PlateDiversityMetrics;
  overallQuality: OverallQualityAssessment;
}



export interface DistributionAnalysis {
  expected: { [key: string]: number };
  actual: { [key: string]: number };
  plateDistributions: { [plateIndex: number]: { [key: string]: number } };
}