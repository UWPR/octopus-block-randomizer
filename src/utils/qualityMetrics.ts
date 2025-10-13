import { log } from 'console';
import { SearchData, QualityMetrics, PlateDiversityMetrics, PlateQualityScore, OverallQualityAssessment } from '../types';
import { getCovariateKey, groupByCovariates } from '../utils';

/**
 * Simplified Quality Metrics Calculator
 *
 * Focuses on two key aspects of plate randomization quality:
 * 1. Plate Balance Score (Proportional Accuracy)
 * 2. Plate Randomization Score (Spatial Clustering Analysis)
 */

// Utility functions
const calculateMean = (values: number[]): number =>
  values.reduce((sum, val) => sum + val, 0) / values.length;

/**
 * Calculate balance for individual covariate groups on a specific plate
 * Returns detailed breakdown of each group's balance
 */
export const calculateCovariateGroupBalance = (
  plateSamples: SearchData[],
  allSamples: SearchData[],
  selectedCovariates: string[]
): { [combination: string]: { actualCount: number; expectedCount: number; actualProportion: number; expectedProportion: number; relativeDeviation: number; balanceScore: number } } => {
  if (plateSamples.length === 0 || allSamples.length === 0) return {};

  const plateCombinations = groupByCovariates(plateSamples, selectedCovariates);
  const globalCombinations = groupByCovariates(allSamples, selectedCovariates);
  const plateSize = plateSamples.length;
  const totalSamples = allSamples.length;

  const result: { [combination: string]: { actualCount: number; expectedCount: number; actualProportion: number; expectedProportion: number; relativeDeviation: number; balanceScore: number } } = {};

  globalCombinations.forEach((globalSamples, combination) => {
    const actualCount = plateCombinations.get(combination)?.length || 0;
    const expectedCount = (globalSamples.length / totalSamples) * plateSize;
    const actualProportion = actualCount / plateSize;
    const expectedProportion = globalSamples.length / totalSamples;

    // Calculate relative percent deviation
    let relativeDeviation: number;
    if (expectedProportion > 0) {
      relativeDeviation = Math.abs(actualProportion - expectedProportion) / expectedProportion;
    } else {
      relativeDeviation = actualProportion > 0 ? 1 : 0;
    }

    // Convert to individual balance score for this group
    const cappedDeviation = Math.min(relativeDeviation, 1.0);
    const balanceScore = Math.round(Math.max(0, 100 - (cappedDeviation * 100)));

    result[combination] = {
      actualCount,
      expectedCount,
      actualProportion,
      expectedProportion,
      relativeDeviation,
      balanceScore
    };
  });

  return result;
};

/**
 * Calculate plate balance score using Weighted Relative Percent Deviation
 * Measures how well the plate represents overall covariate proportions
 * Uses relative deviation: |actual - expected| / expected for each group
 * Weighted by global proportion: larger population groups have more influence
 */
const calculateBalanceScore = (
  plateSamples: SearchData[],
  globalProportions: Map<string, number>,
  selectedCovariates: string[]
): number => {
  if (plateSamples.length === 0) return 0;

  const plateCombinations = groupByCovariates(plateSamples, selectedCovariates);
  const plateSize = plateSamples.length;

  let validComparisons = 0;

  let totalWeightedDeviation = 0;
  let totalWeight = 0;

  globalProportions.forEach((globalCount, combination) => {
    const actualCount = plateCombinations.get(combination)?.length || 0;
    const actualProportion = actualCount / plateSize;
    const expectedProportion = globalCount / Array.from(globalProportions.values()).reduce((sum, count) => sum + count, 0);

    // Calculate relative percent deviation
    let relativeDeviation: number;
    if (expectedProportion > 0) {
      // Normal case: calculate relative deviation as percentage
      relativeDeviation = Math.abs(actualProportion - expectedProportion) / expectedProportion;
    } else {
      // Edge case: expected is 0, so any actual samples represent infinite deviation
      relativeDeviation = actualProportion > 0 ? 1 : 0;
    }

    // Weight by global proportion (larger population groups have more influence)
    const weight = expectedProportion;
    totalWeightedDeviation += relativeDeviation * weight;
    totalWeight += weight;
    validComparisons++;
  });

  if (validComparisons === 0 || totalWeight === 0) return 0;

  // Weighted average relative deviation (larger groups have more influence)
  const weightedAverageDeviation = totalWeightedDeviation / totalWeight;

  // Convert to balance score (0-100 scale):
  // - 0% weighted deviation = 100 (perfect balance)
  // - 50% weighted deviation = 50 (moderate balance)
  // - 100% weighted deviation = 0 (poor balance)
  // Cap at 100% deviation to prevent negative scores
  const cappedDeviation = Math.min(weightedAverageDeviation, 1.0);
  return Math.round(Math.max(0, 100 - (cappedDeviation * 100)));
};

/**
 * Calculate spatial clustering score for randomization quality
 * Measures whether similar samples are clustered together spatially
 */
const calculateSpatialClusteringScore = (
  plateRows: (SearchData | undefined)[][],
  selectedCovariates: string[]
): number => {
  if (plateRows.length === 0) return 0;

  const numRows = plateRows.length;
  const numCols = plateRows[0]?.length || 0;

  let totalComparisons = 0;
  let differentNeighbors = 0;

  // Helper function to get neighbors of a cell
  const getNeighbors = (row: number, col: number): Array<{ row: number, col: number }> => {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue; // Skip self
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < numRows && newCol >= 0 && newCol < numCols) {
          neighbors.push({ row: newRow, col: newCol });
        }
      }
    }
    return neighbors;
  };

  // Check each sample against its neighbors
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const currentSample = plateRows[row][col];
      if (!currentSample) continue;

      const currentKey = getCovariateKey(currentSample, selectedCovariates);
      const neighbors = getNeighbors(row, col);

      for (const neighbor of neighbors) {
        const neighborSample = plateRows[neighbor.row][neighbor.col];
        if (!neighborSample) continue;

        const neighborKey = getCovariateKey(neighborSample, selectedCovariates);
        totalComparisons++;

        if (currentKey !== neighborKey) {
          differentNeighbors++;
        }
      }
    }
  }

  if (totalComparisons === 0) return 100; // No neighbors to compare

  // Higher percentage of different neighbors = better randomization
  return (differentNeighbors / totalComparisons) * 100;
};

/**
 * Calculate plate diversity metrics (Balance + Randomization scores)
 */
export const calculatePlateDiversityMetrics = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  randomizedPlates: (SearchData | undefined)[][][],
  selectedCovariates: string[]
): PlateDiversityMetrics => {
  if (!searches.length || !plateAssignments.size || !selectedCovariates.length) {
    return {
      averageBalanceScore: 0,
      averageRandomizationScore: 0,
      plateScores: []
    };
  }

  const combinationGroups = groupByCovariates(searches, selectedCovariates);
  const plateScores: PlateQualityScore[] = [];

  // Convert combination groups to counts for balance calculation
  const globalCombinationCounts = new Map<string, number>();
  combinationGroups.forEach((samples, combination) => {
    globalCombinationCounts.set(combination, samples.length);
  });

  plateAssignments.forEach((plateSamples, plateIndex) => {
    console.log(`Calculating metrics for plate ${plateIndex + 1} with ${plateSamples.length} samples`);
    // Calculate balance score (proportional accuracy)
    const balanceScore = calculateBalanceScore(plateSamples, globalCombinationCounts, selectedCovariates);

    // Calculate randomization score (spatial clustering)
    const plateRows = randomizedPlates[plateIndex] || [];
    const randomizationScore = calculateSpatialClusteringScore(plateRows, selectedCovariates);

    // Overall score is average of both metrics
    const overallScore = (balanceScore + randomizationScore) / 2;

    plateScores.push({
      plateIndex,
      balanceScore,
      randomizationScore,
      overallScore
    });
  });

  const averageBalanceScore = calculateMean(plateScores.map(score => score.balanceScore));
  const averageRandomizationScore = calculateMean(plateScores.map(score => score.randomizationScore));

  return {
    averageBalanceScore,
    averageRandomizationScore,
    plateScores
  };
};

/**
 * Calculate overall quality assessment
 */
export const calculateOverallQuality = (
  plateDiversity: PlateDiversityMetrics
): OverallQualityAssessment => {
  const recommendations: string[] = [];

  // Check plate balance
  if (plateDiversity.averageBalanceScore < 70) {
    recommendations.push(`Low plate balance (${plateDiversity.averageBalanceScore.toFixed(1)}) - plates may not represent overall population well`);
  }

  // Check randomization quality
  if (plateDiversity.averageRandomizationScore < 70) {
    recommendations.push(`Poor spatial randomization (${plateDiversity.averageRandomizationScore.toFixed(1)}) - similar samples may be clustered together`);
  }

  // Identify problematic plates
  const poorPlates = plateDiversity.plateScores.filter(score =>
    score.balanceScore < 60 || score.randomizationScore < 60
  );

  if (poorPlates.length > 0) {
    const plateNumbers = poorPlates.map(p => p.plateIndex + 1).join(', ');
    recommendations.push(`Plates ${plateNumbers} have poor quality scores`);
  }

  // Calculate overall score (equal weight to balance and randomization)
  const overallScore = (plateDiversity.averageBalanceScore + plateDiversity.averageRandomizationScore) / 2;

  // Determine quality level
  let level: 'excellent' | 'good' | 'fair' | 'poor';
  if (overallScore >= 85) level = 'excellent';
  else if (overallScore >= 75) level = 'good';
  else if (overallScore >= 65) level = 'fair';
  else level = 'poor';

  return {
    score: Math.round(overallScore),
    level,
    recommendations
  };
};

/**
 * Main function to calculate all quality metrics
 */
export const calculateQualityMetrics = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  randomizedPlates: (SearchData | undefined)[][][],
  selectedCovariates: string[]
): QualityMetrics => {
  const plateDiversity = calculatePlateDiversityMetrics(
    searches,
    plateAssignments,
    randomizedPlates,
    selectedCovariates
  );

  const overallQuality = calculateOverallQuality(plateDiversity);

  return {
    plateDiversity,
    overallQuality
  };
};