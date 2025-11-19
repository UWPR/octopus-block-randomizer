import { SearchData } from '../utils/types';
import { shuffleArray, getCovariateKey } from '../utils/utils';

/**
 * Calculate a clustering score for placing a sample at a specific position.
 * Lower scores indicate better positions (less clustering).
 *
 * @param plateIdx - Index of the plate
 * @param rowIdx - Row index within the plate
 * @param colIdx - Column index within the row
 * @param treatmentKey - The covariate group key of the sample being placed
 * @param plates - The 3D grid of plates
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @returns Clustering score (lower is better)
 */
export function calculateClusterScore(
  plateIdx: number,
  rowIdx: number,
  colIdx: number,
  treatmentKey: string,
  plates: (SearchData | undefined)[][][],
  selectedCovariates: string[],
  numRows: number,
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
    const leftSample = plates[plateIdx][rowIdx][colIdx - 1];
    if (getTreatmentKey(leftSample) === treatmentKey) {
      score += 10; // Heavy penalty for horizontal adjacency
    }
  }

  // Check right neighbor (horizontal) - may already be placed since we fill greedily
  if (colIdx < numColumns - 1) {
    const rightSample = plates[plateIdx][rowIdx][colIdx + 1];
    if (getTreatmentKey(rightSample) === treatmentKey) {
      score += 10; // Heavy penalty for horizontal adjacency
    }
  }

  // Check above neighbor (vertical)
  // Only check above since rows are filled sequentially (below is always empty)
  if (rowIdx > 0) {
    const aboveSample = plates[plateIdx][rowIdx - 1][colIdx];
    if (getTreatmentKey(aboveSample) === treatmentKey) {
      score += 8; // Medium-high penalty for vertical adjacency
    }
  }

  // Cross-row constraint: check if this is the first column and previous row's last column
  if (colIdx === 0 && rowIdx > 0) {
    const prevRowLastSample = plates[plateIdx][rowIdx - 1][numColumns - 1];
    if (getTreatmentKey(prevRowLastSample) === treatmentKey) {
      score += 15; // Very heavy penalty for cross-row adjacency
    }
  }

  return score;
}

/**
 * Place samples in a row using greedy spatial placement to minimize clustering.
 *
 * @param samples - Array of samples to place in this row
 * @param plateIdx - Index of the plate
 * @param rowIdx - Row index within the plate
 * @param plates - The 3D grid of plates (will be modified)
 * @param selectedCovariates - List of selected covariate names
 * @param numColumns - Total number of columns per row
 * @param numRows - Total number of rows per plate
 */
export function greedyPlaceInRow(
  samples: SearchData[],
  plateIdx: number,
  rowIdx: number,
  plates: (SearchData | undefined)[][][],
  selectedCovariates: string[],
  numColumns: number,
  numRows: number
): void {
  if (samples.length === 0) return;

  // Shuffle samples first to add randomness when multiple positions have equal scores
  const shuffledSamples = shuffleArray([...samples]);

  // Track available positions in this row
  const availablePositions: number[] = [];
  for (let col = 0; col < Math.min(numColumns, samples.length); col++) {
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
        plateIdx,
        rowIdx,
        col,
        treatmentKey,
        plates,
        selectedCovariates,
        numRows,
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
    plates[plateIdx][rowIdx][chosenCol] = sample;

    // Remove chosen position from available positions
    const posIndex = availablePositions.indexOf(chosenCol);
    if (posIndex > -1) {
      availablePositions.splice(posIndex, 1);
    }

    console.log(
      `Placed sample with treatment ${treatmentKey} at plate ${plateIdx}, row ${rowIdx}, col ${chosenCol} (score: ${minScore})`
    );
  }
}

/**
 * Analyze the quality of spatial distribution in a plate.
 * Returns metrics about clustering.
 *
 * @param plates - The 3D grid of plates
 * @param selectedCovariates - List of selected covariate names
 * @param numRows - Total number of rows per plate
 * @param numColumns - Total number of columns per row
 * @returns Object with clustering metrics
 */
export function analyzeSpatialQuality(
  plates: (SearchData | undefined)[][][],
  selectedCovariates: string[],
  numRows: number,
  numColumns: number
): {
  horizontalClusters: number;
  verticalClusters: number;
  crossRowClusters: number;
  totalClusters: number;
} {
  let horizontalClusters = 0;
  let verticalClusters = 0;
  let crossRowClusters = 0;

  const getTreatmentKey = (sample: SearchData | undefined): string | null => {
    if (!sample) return null;
    return getCovariateKey(sample, selectedCovariates);
  };

  plates.forEach((plate, plateIdx) => {
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
  });

  return {
    horizontalClusters,
    verticalClusters,
    crossRowClusters,
    totalClusters: horizontalClusters + verticalClusters + crossRowClusters
  };
}
