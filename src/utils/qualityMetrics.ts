import { SearchData, QualityMetrics, CovariateGroupMetric, PlateDiversityMetrics, PlateQualityScore, OverallQualityAssessment } from '../types';
import { getCovariateKey, groupByCovariates } from '../utils';

/**
 * Simplified Quality Metrics Calculator
 *
 * Focuses on the two most important aspects of randomization quality:
 * 1. Covariate Group Balance (CV + p-value with small group adjustment)
 * 2. Plate Diversity (Proportional Accuracy + Entropy)
 */

// Statistical utility functions
const calculateMean = (values: number[]): number =>
  values.reduce((sum, val) => sum + val, 0) / values.length;

const calculateStandardDeviation = (values: number[]): number => {
  const mean = calculateMean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const calculateChiSquare = (observed: number[], expected: number[]): { chiSquare: number; pValue: number } => {
  if (observed.length !== expected.length) {
    throw new Error(`Observed and expected arrays must have the same length. Got ${observed.length} vs ${expected.length}`);
  }

  let chiSquare = 0;
  let validComparisons = 0;

  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
      validComparisons++;
    }
  }

  // Simplified p-value calculation
  const degreesOfFreedom = Math.max(1, validComparisons - 1);
  const pValue = Math.exp(-chiSquare / (2 * degreesOfFreedom));

  return { chiSquare, pValue };
};

/**
 * Calculate covariate group metrics with small group adjustment
 */
export const calculateCovariateGroupMetrics = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  selectedCovariates: string[]
): { [combination: string]: CovariateGroupMetric } => {
  const result: { [combination: string]: CovariateGroupMetric } = {};

  if (!searches.length || !plateAssignments.size || !selectedCovariates.length) {
    return result;
  }

  const combinationGroups = groupByCovariates(searches, selectedCovariates);
  const numPlates = plateAssignments.size;

  Array.from(combinationGroups.keys()).forEach(combination => {
    const globalCount = combinationGroups.get(combination)?.length || 0;
    const expectedPerPlate = globalCount / numPlates;
    const isSmallGroup = globalCount < numPlates;

    // Calculate actual distribution across plates
    const actualCounts: number[] = [];
    const expectedCounts: number[] = [];

    plateAssignments.forEach(plateSamples => {
      const actualCount = plateSamples.filter(sample =>
        getCovariateKey(sample, selectedCovariates) === combination
      ).length;

      actualCounts.push(actualCount);
      expectedCounts.push(expectedPerPlate);
    });

    // Calculate CV
    const mean = calculateMean(actualCounts);
    const std = calculateStandardDeviation(actualCounts);
    const cv = mean > 0 ? (std / mean) * 100 : 0;

    // Calculate p-value
    let pValue = 1;
    try {
      const chiSquareResult = calculateChiSquare(actualCounts, expectedCounts);
      pValue = chiSquareResult.pValue;
    } catch (error) {
      console.warn(`Chi-square calculation failed for combination ${combination}:`, error);
    }

    // Assess quality with small group adjustment
    const adjustedAssessment = assessCovariateGroup(cv, pValue, isSmallGroup);

    result[combination] = {
      sampleCount: globalCount,
      cv,
      pValue,
      isSmallGroup,
      adjustedAssessment
    };
  });

  return result;
};

/**
 * Assess covariate group quality with adjustment for small groups
 */
const assessCovariateGroup = (
  cv: number,
  pValue: number,
  isSmallGroup: boolean
): 'good' | 'acceptable' | 'poor' => {
  if (isSmallGroup) {
    // Relaxed criteria for small groups (fewer samples than plates)
    if (pValue >= 0.10) return 'good';      // Less strict p-value threshold
    if (pValue >= 0.05) return 'acceptable';
    return 'poor';
  } else {
    // Standard criteria for larger groups
    if (pValue >= 0.05 && cv < 30) return 'good';
    if (pValue >= 0.05 || cv < 50) return 'acceptable';
    return 'poor';
  }
};

/**
 * Calculate plate entropy (diversity measure)
 */
const calculatePlateEntropy = (
  plateSamples: SearchData[],
  selectedCovariates: string[],
  totalPossibleCombinations: number
): number => {
  if (plateSamples.length === 0) return 0;

  const combinationCounts = new Map<string, number>();

  plateSamples.forEach(sample => {
    const key = getCovariateKey(sample, selectedCovariates);
    combinationCounts.set(key, (combinationCounts.get(key) || 0) + 1);
  });

  let entropy = 0;
  const totalSamples = plateSamples.length;

  combinationCounts.forEach(count => {
    const proportion = count / totalSamples;
    if (proportion > 0) {
      entropy -= proportion * Math.log2(proportion);
    }
  });

  // Normalize to 0-100 scale
  const maxPossibleEntropy = Math.log2(totalPossibleCombinations);
  return maxPossibleEntropy > 0 ? (entropy / maxPossibleEntropy) * 100 : 0;
};

/**
 * Calculate plate proportional accuracy (representativeness measure)
 */
const calculateProportionalAccuracy = (
  plateSamples: SearchData[],
  globalProportions: Map<string, number>,
  selectedCovariates: string[]
): number => {
  if (plateSamples.length === 0) return 0;

  const plateCombinations = groupByCovariates(plateSamples, selectedCovariates);
  const plateSize = plateSamples.length;

  let totalDeviation = 0;
  let validComparisons = 0;

  globalProportions.forEach((globalCount, combination) => {
    const actualCount = plateCombinations.get(combination)?.length || 0;
    const actualProportion = actualCount / plateSize;
    const expectedProportion = globalCount / Array.from(globalProportions.values()).reduce((sum, count) => sum + count, 0);

    const deviation = Math.abs(actualProportion - expectedProportion);
    totalDeviation += deviation;
    validComparisons++;
  });

  if (validComparisons === 0) return 0;

  const averageDeviation = totalDeviation / validComparisons;
  return Math.max(0, 100 - (averageDeviation * 100));
};

/**
 * Calculate plate diversity metrics
 */
export const calculatePlateDiversityMetrics = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  selectedCovariates: string[]
): PlateDiversityMetrics => {
  const combinationGroups = groupByCovariates(searches, selectedCovariates);
  const totalPossibleCombinations = combinationGroups.size;

  const plateScores: PlateQualityScore[] = [];

  // Convert combination groups to counts for proportional accuracy calculation
  const globalCombinationCounts = new Map<string, number>();
  combinationGroups.forEach((samples, combination) => {
    globalCombinationCounts.set(combination, samples.length);
  });

  plateAssignments.forEach((plateSamples, plateIndex) => {
    const entropy = calculatePlateEntropy(plateSamples, selectedCovariates, totalPossibleCombinations);
    const proportionalAccuracy = calculateProportionalAccuracy(plateSamples, globalCombinationCounts, selectedCovariates);

    plateScores.push({
      plateIndex,
      proportionalAccuracy,
      entropy
    });
  });

  const averageProportionalAccuracy = calculateMean(plateScores.map(score => score.proportionalAccuracy));
  const averageEntropy = calculateMean(plateScores.map(score => score.entropy));

  return {
    averageProportionalAccuracy,
    averageEntropy,
    plateScores
  };
};

/**
 * Generate recommendations based on quality metrics
 */
const generateRecommendations = (
  covariateGroups: { [combination: string]: CovariateGroupMetric },
  plateDiversity: PlateDiversityMetrics
): string[] => {
  const recommendations: string[] = [];

  // Check covariate groups
  const poorGroups = Object.entries(covariateGroups).filter(([_, metric]) => metric.adjustedAssessment === 'poor');
  const acceptableGroups = Object.entries(covariateGroups).filter(([_, metric]) => metric.adjustedAssessment === 'acceptable');

  if (poorGroups.length > 0) {
    recommendations.push(`${poorGroups.length} covariate combination(s) show poor balance - consider re-randomization`);

    // Identify specific issues
    poorGroups.forEach(([combination, metric]) => {
      if (metric.isSmallGroup) {
        recommendations.push(`Small group "${combination}" (${metric.sampleCount} samples) shows significant imbalance`);
      } else {
        recommendations.push(`Large group "${combination}" shows systematic imbalance (CV: ${metric.cv.toFixed(1)}%, p: ${metric.pValue.toFixed(3)})`);
      }
    });
  }

  if (acceptableGroups.length > 0 && poorGroups.length === 0) {
    recommendations.push(`${acceptableGroups.length} covariate combination(s) show acceptable but not optimal balance`);
  }

  // Check plate diversity
  if (plateDiversity.averageProportionalAccuracy < 70) {
    recommendations.push(`Low plate representativeness (${plateDiversity.averageProportionalAccuracy.toFixed(1)}) - plates may not represent overall population well`);
  }

  if (plateDiversity.averageEntropy < 50) {
    recommendations.push(`Low plate diversity (${plateDiversity.averageEntropy.toFixed(1)}) - some plates may be dominated by few combinations`);
  }

  // Identify problematic plates
  const poorPlates = plateDiversity.plateScores.filter(score =>
    score.proportionalAccuracy < 60 || score.entropy < 40
  );

  if (poorPlates.length > 0) {
    const plateNumbers = poorPlates.map(plate => plate.plateIndex + 1).join(', ');
    recommendations.push(`Plates ${plateNumbers} show poor quality - review their composition`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Randomization quality is excellent - ready for experiment');
  }

  return recommendations;
};

/**
 * Calculate overall quality assessment
 */
const calculateOverallQuality = (
  covariateGroups: { [combination: string]: CovariateGroupMetric },
  plateDiversity: PlateDiversityMetrics
): OverallQualityAssessment => {
  // Calculate covariate quality score
  const groupAssessments = Object.values(covariateGroups);
  const goodGroups = groupAssessments.filter(g => g.adjustedAssessment === 'good').length;
  const acceptableGroups = groupAssessments.filter(g => g.adjustedAssessment === 'acceptable').length;
  const totalGroups = groupAssessments.length;

  const covariateScore = totalGroups > 0 ?
    ((goodGroups * 100) + (acceptableGroups * 75)) / totalGroups : 0;

  // Calculate plate quality score (weighted toward proportional accuracy)
  const plateScore = (plateDiversity.averageProportionalAccuracy * 0.7) + (plateDiversity.averageEntropy * 0.3);

  // Overall score (covariate balance more important)
  const overallScore = (covariateScore * 0.6) + (plateScore * 0.4);

  // Determine quality level
  let level: 'excellent' | 'good' | 'fair' | 'poor';
  if (overallScore >= 90) level = 'excellent';
  else if (overallScore >= 75) level = 'good';
  else if (overallScore >= 60) level = 'fair';
  else level = 'poor';

  const recommendations = generateRecommendations(covariateGroups, plateDiversity);

  return {
    score: Math.round(overallScore),
    level,
    recommendations
  };
};

/**
 * Main function to calculate simplified quality metrics
 */
export const calculateQualityMetrics = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  selectedCovariates: string[]
): QualityMetrics => {
  const covariateGroups = calculateCovariateGroupMetrics(searches, plateAssignments, selectedCovariates);
  const plateDiversity = calculatePlateDiversityMetrics(searches, plateAssignments, selectedCovariates);
  const overallQuality = calculateOverallQuality(covariateGroups, plateDiversity);

  return {
    covariateGroups,
    plateDiversity,
    overallQuality
  };
};