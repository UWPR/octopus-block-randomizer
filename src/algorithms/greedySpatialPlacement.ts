import { SearchData } from '../utils/types';
import { shuffleArray, getCovariateKey } from '../utils/utils';

/**
 * Calculate a clustering score for placing a sample at a specific position.
 * Lower scores indicate better positions (less clustering).
 *
 * @param plate - The 2D grid of the current plate
 * @param rowIdx - Row index within the plate
 * @param colIdx - Column index within the row
 * @param treatmentKey - The covariate group key of the sample being placed
 * @param selectedCovariates - List of selected covariate names
 * @param numColumns - Total number of columns per row
 * @returns Clustering score (lower is better)
 */
export function calculateClusterScore(
  plate: (SearchData | undefined)[][],
  rowIdx: number,
  colIdx: number,
  treatmentKey: string,
  selectedCovariates: string[],
  numColumns: number
): number {
  let score = 0;

  // Helper to get treatment key from a sample
  const getTreatmentKey = (sample: SearchData | undefined): string | null => {
    if (!sample) return null;
    return getCovariateKey(sample, selectedCovariates);
  };

  // Check left neighbor (horizontal)
  if (colIdx > 0) {
    const leftSample = plate[rowIdx][colIdx - 1];
    if (getTreatmentKey(leftSample) === treatmentKey) {
      score += 10; // Heavy penalty for horizontal adjacency
    }
  }

  // Check right neighbor (horizontal) - may already be placed since we fill greedily
  if (colIdx < numColumns - 1) {
    const rightSample = plate[rowIdx][colIdx + 1];
    if (getTreatmentKey(rightSample) === treatmentKey) {
      score += 10; // Heavy penalty for horizontal adjacency
    }
  }

  // Check above neighbor (vertical)
  // Only check above since rows are filled sequentially (below is always empty)
  if (rowIdx > 0) {
    const aboveSample = plate[rowIdx - 1][colIdx];
    if (getTreatmentKey(aboveSample) === treatmentKey) {
      score += 10; // Heavy penalty for vertical adjacency
    }
  }

  // Cross-row constraint: check if this is the first column and matches the previous row's last column
  if (colIdx === 0 && rowIdx > 0) {
    const prevRowLastSample = plate[rowIdx - 1][numColumns - 1];
    if (getTreatmentKey(prevRowLastSample) === treatmentKey) {
      score += 8; // Medium-high penalty for cross-row adjacency
    }
  }

  return score;
}

/**
 * Place samples in a row using greedy spatial placement to minimize clustering.
 *
 * @param rowSamples - Array of samples to place in this row
 * @param plate - The 2D grid of the current plate (will be modified)
 * @param rowIdx - Row index within the plate
 * @param selectedCovariates - List of selected covariate names
 * @param numColumns - Total number of columns per row
 */
export function greedyPlaceInRow(
  rowSamples: SearchData[],
  plate: (SearchData | undefined)[][],
  rowIdx: number,
  selectedCovariates: string[],
  numColumns: number
): void {
  if (rowSamples.length === 0) return;

  // Shuffle samples first to add randomness when multiple positions have equal scores
  const shuffledSamples = shuffleArray([...rowSamples]);

  // Track available positions in this row
  const availablePositions: number[] = [];
  for (let col = 0; col < Math.min(numColumns, rowSamples.length); col++) {
    availablePositions.push(col);
  }

  // Place each sample one by one
  for (const sample of shuffledSamples) {
    if (availablePositions.length === 0) break;

    const treatmentKey = getCovariateKey(sample, selectedCovariates);

    // Score each available position
    const positionScores = availablePositions.map(col => ({
      col,
      score: calculateClusterScore(
        plate,
        rowIdx,
        col,
        treatmentKey,
        selectedCovariates,
        numColumns
      )
    }));

    // Find minimum score
    const minScore = Math.min(...positionScores.map(ps => ps.score));

    // Get all positions with minimum score
    const bestPositions = positionScores
      .filter(ps => ps.score === minScore)
      .map(ps => ps.col);

    // Randomly choose among best positions
    const chosenCol = bestPositions[Math.floor(Math.random() * bestPositions.length)];

    // Place the sample
    plate[rowIdx][chosenCol] = sample;

    // Remove chosen position from available positions
    const posIndex = availablePositions.indexOf(chosenCol);
    if (posIndex > -1) {
      availablePositions.splice(posIndex, 1);
    }

    console.log(
      `Placed sample with treatment ${treatmentKey} at row ${rowIdx}, col ${chosenCol} (score: ${minScore})`
    );
  }
}

export interface PlateSpatialQuality {
  plateIndex: number;
  horizontalClusters: number;
  verticalClusters: number;
  crossRowClusters: number;
  totalClusters: number;
}

export interface OverallSpatialQuality {
  plateQualities: PlateSpatialQuality[];
  totalHorizontalClusters: number;
  totalVerticalClusters: number;
  totalCrossRowClusters: number;
  totalClusters: number;
}

/**
 * Analyze the quality of spatial distribution in a single plate.
 * Returns metrics about clustering.
 *
 * @param plate - The 2D grid of a single plate
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @returns Object with clustering metrics for the plate
 */
export function analyzePlateSpatialQuality(
  plate: (SearchData | undefined)[][],
  selectedCovariates: string[],
  numRows: number,
  numColumns: number
): Omit<PlateSpatialQuality, 'plateIndex'> {
  let horizontalClusters = 0;
  let verticalClusters = 0;
  let crossRowClusters = 0;

  const getTreatmentKey = (sample: SearchData | undefined): string | null => {
    if (!sample) return null;
    return getCovariateKey(sample, selectedCovariates);
  };

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numColumns; col++) {
      const currentSample = plate[row][col];
      if (!currentSample) continue;

      const currentKey = getTreatmentKey(currentSample);

      // Check horizontal adjacency (right neighbor)
      if (col < numColumns - 1) {
        const rightSample = plate[row][col + 1];
        if (getTreatmentKey(rightSample) === currentKey) {
          horizontalClusters++;
        }
      }

      // Check vertical adjacency (below neighbor)
      if (row < numRows - 1) {
        const belowSample = plate[row + 1][col];
        if (getTreatmentKey(belowSample) === currentKey) {
          verticalClusters++;
        }
      }

      // Check cross-row adjacency (last column to first column of next row)
      if (col === numColumns - 1 && row < numRows - 1) {
        const nextRowFirstSample = plate[row + 1][0];
        if (getTreatmentKey(nextRowFirstSample) === currentKey) {
          crossRowClusters++;
        }
      }
    }
  }

  return {
    horizontalClusters,
    verticalClusters,
    crossRowClusters,
    totalClusters: horizontalClusters + verticalClusters + crossRowClusters
  };
}

/**
 * Analyze the quality of spatial distribution across all plates.
 * Returns per-plate metrics and overall totals.
 *
 * @param plates - The 3D grid of plates
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @returns Object with per-plate and overall clustering metrics
 */
export function analyzeOverallSpatialQuality(
  plates: (SearchData | undefined)[][][],
  selectedCovariates: string[],
  numRows: number,
  numColumns: number
): OverallSpatialQuality {
  const plateQualities: PlateSpatialQuality[] = [];
  let totalHorizontalClusters = 0;
  let totalVerticalClusters = 0;
  let totalCrossRowClusters = 0;

  plates.forEach((plate, plateIndex) => {
    const quality = analyzePlateSpatialQuality(plate, selectedCovariates, numRows, numColumns);

    plateQualities.push({
      plateIndex,
      ...quality
    });

    totalHorizontalClusters += quality.horizontalClusters;
    totalVerticalClusters += quality.verticalClusters;
    totalCrossRowClusters += quality.crossRowClusters;
  });

  return {
    plateQualities,
    totalHorizontalClusters,
    totalVerticalClusters,
    totalCrossRowClusters,
    totalClusters: totalHorizontalClusters + totalVerticalClusters + totalCrossRowClusters
  };
}

/**
 * Calculate the total clustering score for a plate.
 * This is used to evaluate the quality of the entire plate layout.
 *
 * @param plate - The 2D grid of a single plate
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @returns Total clustering score (lower is better)
 */
function calculatePlateTotalScore(
  plate: (SearchData | undefined)[][],
  selectedCovariates: string[],
  numRows: number,
  numColumns: number
): number {
  let totalScore = 0;

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numColumns; col++) {
      const sample = plate[row][col];
      if (!sample) continue;

      const treatmentKey = getCovariateKey(sample, selectedCovariates);
      totalScore += calculateClusterScore(plate, row, col, treatmentKey, selectedCovariates, numColumns);
    }
  }

  return totalScore;
}

/**
 * Identify all positions that are part of a cluster (have same-treatment neighbors).
 *
 * @param plate - The 2D grid of a single plate
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @returns Array of positions that are in clusters
 */
function identifyClusteredPositions(
  plate: (SearchData | undefined)[][],
  selectedCovariates: string[],
  numRows: number,
  numColumns: number
): Array<{ row: number; col: number }> {
  const clusteredPositions: Array<{ row: number; col: number }> = [];


  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numColumns; col++) {
      const currentSample = plate[row][col];
      if (!currentSample) continue;

      const currentKey = getTreatmentKey(currentSample, selectedCovariates);
      const clustered = isClustered(col, row, plate, currentKey, selectedCovariates, numColumns, numRows);;

      if (clustered) {
        clusteredPositions.push({ row, col });
      }
    }
  }

  return clusteredPositions;
}

function getTreatmentKey(sample: SearchData | undefined, selectedCovariates: string[]): string | null
{
  if (!sample) return null;
    return getCovariateKey(sample, selectedCovariates);
}

function isClustered(
  col: number,
  row: number,
  plate: (SearchData | undefined)[][],
  currentKey: string | null,
  selectedCovariates: string[],
  numColumns: number,
  numRows: number): boolean {

  // Check left neighbor
  if (col > 0) {
    const leftSample = plate[row][col - 1];
    if (getTreatmentKey(leftSample, selectedCovariates) === currentKey) {
      return true;
    }
  }

  // Check right neighbor
  if (!isClustered && col < numColumns - 1) {
    const rightSample = plate[row][col + 1];
    if (getTreatmentKey(rightSample, selectedCovariates) === currentKey) {
      return true;
    }
  }

  // Check above neighbor
  if (!isClustered && row > 0) {
    const aboveSample = plate[row - 1][col];
    if (getTreatmentKey(aboveSample, selectedCovariates) === currentKey) {
      return true;
    }
  }

  // Check below neighbor
  if (!isClustered && row < numRows - 1) {
    const belowSample = plate[row + 1][col];
    if (getTreatmentKey(belowSample, selectedCovariates) === currentKey) {
      return true;
    }
  }

  // Check cross-row (last column of previous row)
  if (!isClustered && col === 0 && row > 0) {
    const prevRowLastSample = plate[row - 1][numColumns - 1];
    if (getTreatmentKey(prevRowLastSample, selectedCovariates) === currentKey) {
      return true;
    }
  }

  // Check cross-row (first column of next row)
  if (!isClustered && col === numColumns - 1 && row < numRows - 1) {
    const nextRowFirstSample = plate[row + 1][0];
    if (getTreatmentKey(nextRowFirstSample, selectedCovariates) === currentKey) {
      return true;
    }
  }
  return false;
}

/**
 * Perform global optimization on a plate by swapping clustered positions to reduce clustering.
 * Uses a targeted hill-climbing approach: identifies clustered positions and tries swapping them.
 *
 * @param plate - The 2D grid of a single plate (will be modified)
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @param maxIterations - Maximum number of swap attempts (default: 100)
 * @returns Number of successful swaps made
 */
export function optimizePlateLayout(
  plate: (SearchData | undefined)[][],
  selectedCovariates: string[],
  numRows: number,
  numColumns: number,
  maxIterations: number = 100
): number {
  let improvementsMade = 0;
  let currentScore = calculatePlateTotalScore(plate, selectedCovariates, numRows, numColumns);

  console.log(`Starting optimization with initial score: ${currentScore}`);

  // Collect all filled positions for fallback
  const allFilledPositions: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numColumns; col++) {
      if (plate[row][col]) {
        allFilledPositions.push({ row, col });
      }
    }
  }

  // Try targeted swaps
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Identify currently clustered positions
    const clusteredPositions = identifyClusteredPositions(plate, selectedCovariates, numRows, numColumns);

    if (clusteredPositions.length === 0) {
      console.log(`  No clusters found after ${iteration} iterations`);
      break;
    }

    // Pick a random clustered position
    const clusteredIdx = Math.floor(Math.random() * clusteredPositions.length);
    const pos1 = clusteredPositions[clusteredIdx];

    // Pick a random position to swap with (from all positions)
    let pos2Idx = Math.floor(Math.random() * allFilledPositions.length);
    let pos2 = allFilledPositions[pos2Idx];

    // Make sure they're different positions
    let attempts = 0;
    while (pos2.row === pos1.row && pos2.col === pos1.col && attempts < 10) {
      pos2Idx = Math.floor(Math.random() * allFilledPositions.length);
      pos2 = allFilledPositions[pos2Idx];
      attempts++;
    }

    if (pos2.row === pos1.row && pos2.col === pos1.col) {
      continue; // Skip if we couldn't find a different position
    }

    // Swap the samples
    const temp = plate[pos1.row][pos1.col];
    plate[pos1.row][pos1.col] = plate[pos2.row][pos2.col];
    plate[pos2.row][pos2.col] = temp;

    // Calculate new score
    const newScore = calculatePlateTotalScore(plate, selectedCovariates, numRows, numColumns);

    // Keep the swap if it improves the score
    if (newScore < currentScore) {
      console.log(`  Swap ${improvementsMade}: improved score from ${currentScore} to ${newScore} (clustered positions: ${clusteredPositions.length})`);
      currentScore = newScore;
      improvementsMade++;
    } else {
      // Revert the swap
      const temp2 = plate[pos1.row][pos1.col];
      plate[pos1.row][pos1.col] = plate[pos2.row][pos2.col];
      plate[pos2.row][pos2.col] = temp2;
    }
  }

  const finalClustered = identifyClusteredPositions(plate, selectedCovariates, numRows, numColumns);
  console.log(`Optimization complete: ${improvementsMade} improvements made, final score: ${currentScore}, remaining clustered positions: ${finalClustered.length}`);
  return improvementsMade;
}

/**
 * Perform global optimization on all plates.
 *
 * @param plates - The 3D grid of plates (will be modified)
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @param maxIterationsPerPlate - Maximum number of swap attempts per plate (default: 100)
 * @returns Total number of successful swaps made across all plates
 */
export function optimizeAllPlates(
  plates: (SearchData | undefined)[][][],
  selectedCovariates: string[],
  numRows: number,
  numColumns: number,
  maxIterationsPerPlate: number = 100
): number {
  let totalImprovements = 0;

  plates.forEach((plate, plateIndex) => {
    console.log(`\nOptimizing plate ${plateIndex + 1}...`);
    const improvements = optimizePlateLayout(
      plate,
      selectedCovariates,
      numRows,
      numColumns,
      maxIterationsPerPlate
    );
    totalImprovements += improvements;
  });

  console.log(`\nTotal improvements across all plates: ${totalImprovements}`);
  return totalImprovements;
}
