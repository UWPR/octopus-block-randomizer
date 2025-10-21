import { SearchData, QualityMetrics, PlateDiversityMetrics, PlateQualityScore, OverallQualityAssessment, QualityLevel, QualityDisplayConfig, DEFAULT_QUALITY_DISPLAY_CONFIG } from '../types';
import { getCovariateKey, groupByCovariates, getQualityLevel, getNeighborPositions } from '../utils';

/**
 * Simplified Quality Metrics Calculator
 *
 * Focuses on two key aspects of plate randomization quality:
 * 1. Plate Balance Score (Proportional Accuracy)
 * 2. Row Clustering Score (Row-level Pattern Detection)
 */

// Utility functions
const calculateMean = (values: number[]): number =>
  values.reduce((sum, val) => sum + val, 0) / values.length;

/**
 * Calculate comprehensive plate balance metrics
 * Returns both overall weighted balance score and detailed breakdown for each covariate group
 */
const calculatePlateBalance = (
  plateSamples: SearchData[],
  allSamples: SearchData[],
  selectedCovariates: string[]
): {
  overallScore: number;
  groupDetails: {
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
} => {
  if (plateSamples.length === 0 || allSamples.length === 0) {
    return { overallScore: 0, groupDetails: {} };
  }

  const plateCombinations = groupByCovariates(plateSamples, selectedCovariates);
  const globalCombinations = groupByCovariates(allSamples, selectedCovariates);
  const plateSize = plateSamples.length;
  const totalSamples = allSamples.length;

  const groupDetails: {
    [combination: string]: {
      actualCount: number;
      expectedCount: number;
      actualProportion: number;
      expectedProportion: number;
      relativeDeviation: number;
      weightedDeviation: number;
      balanceScore: number
    }
  } = {};

  let totalWeightedDeviation = 0;
  let totalWeight = 0;

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

    // Store detailed metrics for this group
    const cappedDeviation = Math.min(relativeDeviation, 1.0);
    const groupBalanceScore = Math.round(Math.max(0, 100 - (cappedDeviation * 100)));

    // Accumulate weighted deviation for overall score (weight by global proportion)
    // const weight = 1; // expectedProportion;
    const weight = expectedProportion;
    const weightedDeviation = relativeDeviation * weight;
    totalWeightedDeviation += weightedDeviation;
    totalWeight += weight;

    groupDetails[combination] = {
      actualCount,
      expectedCount,
      actualProportion,
      expectedProportion,
      relativeDeviation,
      weightedDeviation,
      balanceScore: groupBalanceScore
    };
  });

  // Calculate overall weighted balance score
  let overallScore = 0;
  if (totalWeight > 0) {
    const weightedAverageDeviation = totalWeightedDeviation / totalWeight;
    const cappedDeviation = Math.min(weightedAverageDeviation, 1.0);
    overallScore = Math.round(Math.max(0, 100 - (cappedDeviation * 100)));
  }

  return { overallScore, groupDetails };
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


  // Check each sample against its neighbors
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const currentSample = plateRows[row][col];
      if (!currentSample) continue;

      const currentKey = getCovariateKey(currentSample, selectedCovariates);
      const neighbors = getNeighborPositions(row, col, numRows, numCols);

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
 * Calculate autocorrelation score for pattern detection
 * Detects regular repeating patterns (e.g., ABCABC or ABABAB)
 * Returns 0-100, where 100 = no detectable pattern (good randomness)
 */
const calculateAutocorrelationScore = (keys: string[]): number => {
  if (keys.length <= 3) return 100;

  // Check for patterns at different lags (period lengths)
  const maxLag = Math.min(Math.floor(keys.length / 2), 6); // Check patterns up to length 6
  let maxCorrelation = 0;

  for (let lag = 1; lag <= maxLag; lag++) {
    let matches = 0;
    let comparisons = 0;

    // Count how many positions match at this lag distance
    for (let i = 0; i < keys.length - lag; i++) {
      comparisons++;
      if (keys[i] === keys[i + lag]) {
        matches++;
      }
    }

    const correlation = matches / comparisons;
    maxCorrelation = Math.max(maxCorrelation, correlation);
  }

  // Expected correlation for random distribution (based on number of unique groups)
  const uniqueGroups = new Set(keys).size;
  const expectedCorrelation = 1 / uniqueGroups;

  // Calculate excess correlation beyond what's expected by chance
  const excessCorrelation = Math.max(0, maxCorrelation - expectedCorrelation);

  // Convert to score (0-100)
  // If excess correlation is 0, score is 100 (perfect)
  // If excess correlation is high, score is low (pattern detected)
  const score = 100 - (excessCorrelation * 150); // Scale factor to make penalties meaningful

  return Math.max(0, Math.min(100, score));
};

/**
 * Combined pattern score using both Run Test and Autocorrelation
 * For short sequences (≤12), weights Run Test more heavily
 * For longer sequences, uses equal weighting
 */
const calculatePatternScore = (keys: string[]): number => {
  if (keys.length <= 3) return 100;

  const autocorrScore = calculateAutocorrelationScore(keys);

  return autocorrScore
};

/**
 * Calculate row clustering score
 * Measures both clustering (runs of same group) and regular patterns (predictable alternation)
 * Higher score = better distribution (random-looking, neither clustered nor patterned)
 */
const calculateRowClusteringScore = (
  plateRows: (SearchData | undefined)[][],
  selectedCovariates: string[]
): number => {
  if (plateRows.length === 0) return 0;

  const numRows = plateRows.length;
  let totalScore = 0;
  let analyzedRows = 0;

  // Analyze each row
  for (let row = 0; row < numRows; row++) {
    const rowSamples = plateRows[row].filter((sample): sample is SearchData => sample !== undefined);

    if (rowSamples.length <= 2) continue; // Need at least 3 samples for meaningful analysis

    const rowKeys = rowSamples.map(sample => getCovariateKey(sample, selectedCovariates));

    // Calculate clustering score
    const rowScore = calculateRowScore(rowKeys);
    console.log(`Row ${row} keys: ${rowKeys.join(', ')} => Clustering Score: ${rowScore.toFixed(2)}`);

    totalScore += rowScore;
    analyzedRows++;
  }

  if (analyzedRows === 0) return 100;
  console.log(`Average Row Clustering Score: ${(totalScore / analyzedRows).toFixed(2)}`);
  return totalScore / analyzedRows;
};

/**
 * Calculate expected number of runs of each length for a given sequence composition
 * Based on statistical theory of runs in random sequences
 */
// Export for testing purposes
export const calculateExpectedRunsByGroup = (keys: string[]): Map<string, Map<number, number>> => {
  const n = keys.length;
  const composition = new Map<string, number>();

  // Count composition
  keys.forEach(key => {
    composition.set(key, (composition.get(key) || 0) + 1);
  });

  // Thresholds for switching between exact and approximate calculations
  const EXACT_CALCULATION_THRESHOLD = 24; // Use exact calculation for sequences <= 24 elements
  const useExactCalculation = n <= EXACT_CALCULATION_THRESHOLD;

  console.log(`Using ${useExactCalculation ? 'exact' : 'approximate'} expected run calculation for sequence length ${n}`);

  const expectedRunsByGroup = new Map<string, Map<number, number>>();

  // For each covariate group
  composition.forEach((groupSize, groupKey) => {
    const groupExpectedRuns = new Map<number, number>();

    if (groupSize >= 2) { // Only groups with 2+ samples can have runs
      // For each possible run length for this group
      for (let runLength = 2; runLength <= groupSize; runLength++) {
        let expectedCount: number;

        if (useExactCalculation) {
          // Exact calculation using combinatorial gap analysis
          expectedCount = calculateExactExpectedRunsCombinatorial(n, groupSize, runLength, composition, groupKey);
        } else {
          // Simplified approximation (sampling with replacement)
          const groupProbability = groupSize / n;
          const consecutiveProbability = Math.pow(groupProbability, runLength);
          const possibleStartPositions = Math.max(0, n - runLength + 1);
          expectedCount = possibleStartPositions * consecutiveProbability;
        }

        if (expectedCount > 0.01) { // Only include if expectation is meaningful
          groupExpectedRuns.set(runLength, expectedCount);
        }
      }
    }

    expectedRunsByGroup.set(groupKey, groupExpectedRuns);
  });

  return expectedRunsByGroup;
};

/**
 * Alternative method: Calculate expected sequences using gap-based combinatorial analysis
 * This implements the approach you described:
 * 1. Separate non-target groups and calculate their arrangements
 * 2. Calculate gaps between non-target slots
 * 3. Choose which gaps will have runs of given size
 * 4. Place remaining target members in remaining gaps
 */
export const calculateExpectedSequencesGapMethod = (
  covariateGroups: Map<string, number>,
  targetGroup: string,
  runSize: number,
  numberOfRuns: number
): number => {
  const targetCount = covariateGroups.get(targetGroup) || 0;
  if (targetCount < runSize) return 0;

  // Step 1: Separate non-target groups
  const nonTargetGroups = new Map<string, number>();
  let totalNonTargetCount = 0;

  covariateGroups.forEach((count, group) => {
    if (group !== targetGroup) {
      nonTargetGroups.set(group, count);
      totalNonTargetCount += count;
    }
  });

  // Special case: only target group exists
  if (totalNonTargetCount === 0) {
    // All positions are target group - check if we can have exactly numberOfRuns runs of given size
    const totalPositions = targetCount;
    const maxPossibleRuns = Math.max(0, totalPositions - runSize + 1);
    return numberOfRuns <= maxPossibleRuns ? 1 : 0;
  }

  // Step 2: Calculate arrangements of non-target groups
  // n! / (a1! * a2! * ...)
  const nonTargetArrangements = calculateMultinomialCoefficient(
    totalNonTargetCount,
    Array.from(nonTargetGroups.values())
  );

  // Step 3: Calculate number of gaps between non-target slots
  // Non-target elements create (totalNonTargetCount + 1) gaps
  const totalGaps = totalNonTargetCount + 1;

  // Step 4: Calculate maximum possible runs of the given size
  const maxPossibleRuns = Math.floor(targetCount / runSize);

  // Validation: numberOfRuns parameter must be <= maxPossibleRuns
  if (numberOfRuns > maxPossibleRuns) {
    return 0; // Impossible to have more runs than the maximum possible
  }

  // Validation: numberOfRuns must be <= totalGaps
  if (numberOfRuns > totalGaps) {
    return 0; // Can't place more runs than available gaps
  }

  // Step 5: Calculate for the specific number of runs (r = numberOfRuns)
  const r = numberOfRuns;

  // Choose which gaps will have runs of the given size: C(totalGaps, r)
  const waysToChooseGaps = combination(totalGaps, r);

  // Remaining target members after using r runs of runSize
  const remainingTargetMembers = targetCount - (r * runSize);

  // Remaining gaps after placing r runs
  const remainingGaps = totalGaps - r;

  if (remainingTargetMembers < 0 || remainingGaps < 0) {
    return 0; // Invalid configuration
  }

  // Step 6: Distribute remaining target members in remaining gaps
  // They can have any run size except the given run size
  const waysToDistributeRemaining = calculateWaysToDistributeInGaps(
    remainingTargetMembers,
    remainingGaps
  );

  // Total arrangements with exactly r runs of the specified size
  const arrangementsWithRRuns = nonTargetArrangements * waysToChooseGaps * waysToDistributeRemaining;

  console.log(`Gap method - r=${r}: chooseGaps=${waysToChooseGaps}, distribute=${waysToDistributeRemaining}, arrangements=${arrangementsWithRRuns}`);

  // Calculate total possible arrangements of all groups
  const totalArrangements = calculateMultinomialCoefficient(
    Array.from(covariateGroups.values()).reduce((sum, count) => sum + count, 0),
    Array.from(covariateGroups.values())
  );

  // Return probability of having exactly numberOfRuns runs of the given size
  return arrangementsWithRRuns / totalArrangements;
};

/**
 * Calculate exact expected number of runs using combinatorial gap analysis
 * This is a truly exact calculation based on multinomial arrangements
 */
const calculateExactExpectedRunsCombinatorial = (
  n: number,
  groupSize: number,
  runLength: number,
  composition: Map<string, number>,
  targetGroup: string
): number => {
  if (groupSize < runLength) return 0;
  if (runLength < 2) return 0;

  // Step 1: Separate target group from non-target groups
  const nonTargetGroups = new Map<string, number>();
  let totalNonTargetSize = 0;

  composition.forEach((size, group) => {
    if (group !== targetGroup) {
      nonTargetGroups.set(group, size);
      totalNonTargetSize += size;
    }
  });

  if (totalNonTargetSize === 0) {
    // All samples are from target group - special case
    // Expected runs = total possible runs of this length
    return Math.max(0, n - runLength + 1);
  }

  // Step 2: Calculate total arrangements of non-target groups
  const nonTargetArrangements = calculateMultinomialCoefficient(totalNonTargetSize, Array.from(nonTargetGroups.values()));

  // Step 3: Calculate number of gaps between non-target slots
  // Non-target elements create (totalNonTargetSize + 1) gaps where target elements can go
  const totalGaps = totalNonTargetSize + 1;

  // Step 4: Calculate maximum number of runs of given size we can have
  const maxRunsOfThisSize = Math.floor(groupSize / runLength);

  let totalExpectedRuns = 0;

  // Step 5: For each possible number of runs of the given size (r = 0, 1, 2, ...)
  for (let r = 1; r <= maxRunsOfThisSize; r++) {
    if (r > totalGaps) break; // Can't have more runs than gaps

    // Ways to choose which gaps will have runs of the given size
    const waysToChooseGaps = combination(totalGaps, r);

    // Remaining target group members after using r runs of runLength
    const remainingTargetMembers = groupSize - (r * runLength);

    // Remaining gaps after placing r runs
    const remainingGaps = totalGaps - r;

    if (remainingTargetMembers >= 0 && remainingGaps >= 0) {
      // Ways to distribute remaining target members in remaining gaps
      // (they can form runs of any other size, including size 1)
      const waysToDistributeRemaining = calculateWaysToDistributeInGaps(remainingTargetMembers, remainingGaps);

      // Total arrangements with exactly r runs of the specified length
      const arrangementsWithRRuns = nonTargetArrangements * waysToChooseGaps * waysToDistributeRemaining;

      // Expected number of runs of this length in this configuration
      const expectedRunsForThisR = r * arrangementsWithRRuns;

      totalExpectedRuns += expectedRunsForThisR;

      console.log(`  r=${r}: gaps=${waysToChooseGaps}, remaining=${waysToDistributeRemaining}, arrangements=${arrangementsWithRRuns}, expected=${expectedRunsForThisR}`);
    }
  }

  // Step 6: Calculate total possible arrangements
  const totalArrangements = calculateMultinomialCoefficient(n, Array.from(composition.values()));

  // Return expected number of runs
  return totalExpectedRuns / totalArrangements;
};

/**
 * Calculate multinomial coefficient: n! / (k1! * k2! * ... * km!)
 */
const calculateMultinomialCoefficient = (n: number, groups: number[]): number => {
  let result = factorial(n);
  groups.forEach(groupSize => {
    result /= factorial(groupSize);
  });
  return result;
};

/**
 * Calculate ways to distribute items in gaps (stars and bars problem)
 */
const calculateWaysToDistributeInGaps = (items: number, gaps: number): number => {
  if (items === 0) return 1; // One way to distribute zero items
  if (gaps === 0) return items === 0 ? 1 : 0; // Can only distribute zero items in zero gaps

  // Stars and bars: C(items + gaps - 1, gaps - 1)
  return combination(items + gaps - 1, gaps - 1);
};

/**
 * Calculate factorial with caching for performance
 */
const factorialCache = new Map<number, number>();
const factorial = (n: number): number => {
  if (n <= 1) return 1;
  if (factorialCache.has(n)) return factorialCache.get(n)!;

  const result = n * factorial(n - 1);
  factorialCache.set(n, result);
  return result;
};

/**
 * Calculate combination (n choose k)
 */
const combination = (n: number, k: number): number => {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;

  return factorial(n) / (factorial(k) * factorial(n - k));
};

/**
 * Calculate exact expected number of runs using hypergeometric distribution (APPROXIMATION)
 * This is the previous method - kept for comparison
 */
const calculateExactExpectedRunsHypergeometric = (
  n: number,
  groupSize: number,
  runLength: number
): number => {
  if (groupSize < runLength) return 0;

  let expectedRuns = 0;

  // For each possible starting position
  for (let startPos = 0; startPos <= n - runLength; startPos++) {
    // Calculate probability that positions [startPos, startPos + runLength - 1]
    // are all from the target group using hypergeometric distribution

    // Probability of drawing runLength items of the target group consecutively
    let runProbability = 1;
    let remainingGroupSize = groupSize;
    let remainingTotal = n;

    // Calculate probability for each position in the run
    for (let pos = 0; pos < runLength; pos++) {
      runProbability *= remainingGroupSize / remainingTotal;
      remainingGroupSize--;
      remainingTotal--;
    }

    // Adjust for boundary conditions (run shouldn't be part of a longer run)
    // Use sampling without replacement to be consistent with the run probability calculation
    let boundaryAdjustment = 1;

    // Check if position before run (if exists) should be different
    if (startPos > 0) {
      // At this point, no samples have been used yet, so use original composition
      const otherGroupsSize = n - groupSize;
      boundaryAdjustment *= otherGroupsSize / n;
    }

    // Check if position after run (if exists) should be different
    if (startPos + runLength < n) {
      // At this point, runLength samples from target group have been used
      const remainingOtherGroups = n - groupSize;
      const totalRemaining = remainingTotal; // This is n - runLength
      boundaryAdjustment *= remainingOtherGroups / totalRemaining;
    }

    expectedRuns += runProbability * boundaryAdjustment;
  }

  return expectedRuns;
};

/**
 * Count actual runs by group and length
 */
const getRunCountsByGroup = (runs: Array<{ length: number; group: string }>): Map<string, Map<number, number>> => {
  const countsByGroup = new Map<string, Map<number, number>>();

  runs.forEach(run => {
    if (!countsByGroup.has(run.group)) {
      countsByGroup.set(run.group,
        new Map<number, number>()); // Run length -> number of runs of the length
    }
    const groupCounts = countsByGroup.get(run.group)!;
    groupCounts.set(run.length, (groupCounts.get(run.length) || 0) + 1);
  });

  return countsByGroup;
};

const calculateRowScore = (keys: string[]): number => {

  if (keys.length <= 3) return 100;

  // Track runs with their covariate groups
  const runs: Array<{ length: number; group: string }> = [];
  let currentRun = 1;
  let currentGroup = keys[0];

  for (let i = 1; i < keys.length; i++) {
    if (keys[i] !== keys[i - 1]) {
      // End of current run
      runs.push({ length: currentRun, group: currentGroup });
      currentRun = 1;
      currentGroup = keys[i];
    } else {
      currentRun++;
    }

    if (i === keys.length - 1) {
      // End of sequence
      runs.push({ length: currentRun, group: currentGroup });
    }
  }

  const filteredRuns = runs.filter(run => run.length > 1); // Remove runs of size 1
  console.log(`Runs: ${filteredRuns.map(r => `${r.group}:${r.length}`).join(', ')}`);

  if (filteredRuns.length === 0) return 100;

  // Calculate expected runs by group
  const expectedRunsByGroup = calculateExpectedRunsByGroup(keys);
  const actualRunCountsByGroup = getRunCountsByGroup(filteredRuns);

  let totalPenalty = 0;

  // Compare actual vs expected runs for each group and length
  actualRunCountsByGroup.forEach((groupRunCounts, groupKey) => {
    const expectedGroupRuns = expectedRunsByGroup.get(groupKey) || new Map<number, number>();

    groupRunCounts.forEach((actualCount, runLength) => {
      const expectedCount = expectedGroupRuns.get(runLength) || 0;
      const excess = Math.max(0, actualCount - expectedCount);

      if (excess > 0) {
        // Penalty based on how much we exceed expectation for this specific group
        // Longer runs get higher base penalty, scaled by excess
        const basePenalty = Math.pow(runLength, 1.5) * 10; // Base penalty increases with run length
        const excessPenalty = excess * basePenalty;

        console.log(`  Group ${groupKey}, run length ${runLength}: expected ${expectedCount.toFixed(2)}, actual ${actualCount}, excess ${excess.toFixed(2)}, penalty ${excessPenalty.toFixed(2)}`);
        totalPenalty += excessPenalty;
      }
    });
  });
  console.log(`Total Penalty: ${totalPenalty.toFixed(2)}`);
  const score = (100 - totalPenalty);

  // Convert to score (0-100).  If no penalty score is 100.  If penalty is high, score is 0
  return Math.max(0, Math.min(100, score));
};

/**
 * Calculate plate diversity metrics (Balance + Randomization + Row Clustering scores)
 */
export const calculatePlateDiversityMetrics = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  randomizedPlates: (SearchData | undefined)[][][],
  selectedCovariates: string[],
  displayConfig: QualityDisplayConfig = DEFAULT_QUALITY_DISPLAY_CONFIG
): PlateDiversityMetrics => {
  if (!searches.length || !plateAssignments.size || !selectedCovariates.length) {
    return {
      averageBalanceScore: 0,
      averageRowClusteringScore: 0,
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
    // Calculate comprehensive balance metrics (both overall score and group details)
    const plateBalance = calculatePlateBalance(plateSamples, searches, selectedCovariates);

    // Calculate randomization score (spatial clustering) if enabled
    const plateRows = randomizedPlates[plateIndex] || [];
    const rowClusteringScore = displayConfig.showRandomizationScore
      ? calculateRowClusteringScore(plateRows, selectedCovariates)
      : 0;

    // Calculate overall score based on display configuration
    const overallScore = displayConfig.showRandomizationScore
      ? (plateBalance.overallScore + rowClusteringScore) / 2
      : plateBalance.overallScore;

    plateScores.push({
      plateIndex,
      balanceScore: plateBalance.overallScore,
      rowClusteringScore,
      // randomizationScore,
      overallScore,
      covariateGroupBalance: plateBalance.groupDetails
    });
  });

  const averageBalanceScore = calculateMean(plateScores.map(score => score.balanceScore));
  const averageRowClusteringScore = displayConfig.showRandomizationScore
    ? calculateMean(plateScores.map(score => score.rowClusteringScore))
    : 0;

  return {
    averageBalanceScore,
    averageRowClusteringScore,
    plateScores
  };
};

/**
 * Calculate overall quality assessment
 */
export const calculateOverallQuality = (
  plateDiversity: PlateDiversityMetrics,
  displayConfig: QualityDisplayConfig = DEFAULT_QUALITY_DISPLAY_CONFIG
): OverallQualityAssessment => {
  const recommendations: string[] = [];

  // Calculate overall score based on display configuration
  const overallScore = displayConfig.showRandomizationScore
    ? (plateDiversity.averageBalanceScore + plateDiversity.averageRowClusteringScore) / 2
    : plateDiversity.averageBalanceScore;

  // Determine quality level using utility function
  const level = getQualityLevel(overallScore);

  return {
    score: Math.round(overallScore * 10) / 10, // Round to 1 decimal place
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
  selectedCovariates: string[],
  displayConfig: QualityDisplayConfig = DEFAULT_QUALITY_DISPLAY_CONFIG
): QualityMetrics => {
  const plateDiversity = calculatePlateDiversityMetrics(
    searches,
    plateAssignments,
    randomizedPlates,
    selectedCovariates,
    displayConfig
  );

  const overallQuality = calculateOverallQuality(plateDiversity, displayConfig);

  return {
    plateDiversity,
    overallQuality
  };
};