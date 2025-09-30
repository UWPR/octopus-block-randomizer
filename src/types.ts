export interface SearchData {
    name: string;
    metadata: { [key: string]: string };
}
export type RandomizationAlgorithm = 'greedy' | 'balanced';

export interface RandomizationOptions {
    algorithm: RandomizationAlgorithm;
    selectedCovariates: string[];
    // Additional options for future algorithms
    maxIterations?: number;
    balanceWeight?: number;
}