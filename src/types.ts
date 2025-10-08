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