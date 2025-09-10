export interface SearchData {
    name: string;
    metadata: { [key: string]: string };
}
export type RandomizationAlgorithm = 'greedy' | 'optimized' | 'latin_square';

export interface RandomizationOptions {
    algorithm: RandomizationAlgorithm;
    selectedCovariates: string[];
    // Additional options for future algorithms
    maxIterations?: number;
    balanceWeight?: number;
}