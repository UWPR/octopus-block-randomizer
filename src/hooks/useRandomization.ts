import { useState } from 'react';
import { SearchData, RandomizationAlgorithm, RepeatedMeasuresGroup, RepeatedMeasuresQualityMetrics } from '../utils/types';
import { randomizeSearches } from '../utils/utils';

export function useRandomization() {
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [randomizedPlates, setRandomizedPlates] = useState<(SearchData | undefined)[][][]>([]);
  const [plateAssignments, setPlateAssignments] = useState<Map<number, SearchData[]> | undefined>(undefined);
  const [repeatedMeasuresGroups, setRepeatedMeasuresGroups] = useState<RepeatedMeasuresGroup[] | undefined>(undefined);
  const [repeatedMeasuresQualityMetrics, setRepeatedMeasuresQualityMetrics] = useState<RepeatedMeasuresQualityMetrics | undefined>(undefined);

  const processRandomization = (
    searches: SearchData[],
    selectedCovariates: string[],
    selectedAlgorithm: RandomizationAlgorithm,
    keepEmptyInLastPlate: boolean,
    plateRows: number,
    plateColumns: number,
    repeatedMeasuresVariable?: string
  ) => {
    if (searches.length > 0 && selectedCovariates.length > 0) {
      const result = randomizeSearches(
        searches,
        selectedCovariates,
        selectedAlgorithm,
        keepEmptyInLastPlate,
        plateRows,
        plateColumns,
        repeatedMeasuresVariable
      );
      setRandomizedPlates(result.plates);
      setPlateAssignments(result.plateAssignments);
      setRepeatedMeasuresGroups(result.repeatedMeasuresGroups);
      setRepeatedMeasuresQualityMetrics(result.qualityMetrics);
      setIsProcessed(true);
      return true;
    }
    return false;
  };

  const reRandomize = (
    searches: SearchData[],
    selectedCovariates: string[],
    selectedAlgorithm: RandomizationAlgorithm,
    keepEmptyInLastPlate: boolean,
    plateRows: number,
    plateColumns: number,
    repeatedMeasuresVariable?: string
  ) => {
    if (searches.length > 0 && selectedCovariates.length > 0) {
      const result = randomizeSearches(
        searches,
        selectedCovariates,
        selectedAlgorithm,
        keepEmptyInLastPlate,
        plateRows,
        plateColumns,
        repeatedMeasuresVariable
      );
      setRandomizedPlates(result.plates);
      setPlateAssignments(result.plateAssignments);
      setRepeatedMeasuresGroups(result.repeatedMeasuresGroups);
      setRepeatedMeasuresQualityMetrics(result.qualityMetrics);
    }
  };

  const resetRandomization = () => {
    setIsProcessed(false);
    setRandomizedPlates([]);
    setPlateAssignments(undefined);
    setRepeatedMeasuresGroups(undefined);
    setRepeatedMeasuresQualityMetrics(undefined);
  };

  const updatePlates = (
    fromPlate: number,
    fromRow: number,
    fromCol: number,
    toPlate: number,
    toRow: number,
    toCol: number
  ) => {
    const updatedRandomizedPlates = [...randomizedPlates];
    const sourceSearch = updatedRandomizedPlates[fromPlate][fromRow][fromCol];
    const targetSearch = updatedRandomizedPlates[toPlate][toRow][toCol];

    // Swap positions in plates
    updatedRandomizedPlates[fromPlate][fromRow][fromCol] = targetSearch;
    updatedRandomizedPlates[toPlate][toRow][toCol] = sourceSearch;

    // Update plateAssignments if it exists
    if (plateAssignments) {
      const updatedPlateAssignments = new Map(plateAssignments);

      // If swapping between different plates, update the assignments
      if (fromPlate !== toPlate) {
        const fromPlateSearches = updatedPlateAssignments.get(fromPlate) || [];
        const toPlateSearches = updatedPlateAssignments.get(toPlate) || [];

        // Remove and add searches to maintain correct plate assignments
        if (sourceSearch) {
          const sourceIndex = fromPlateSearches.findIndex(s => s.name === sourceSearch.name);
          if (sourceIndex !== -1) {
            fromPlateSearches.splice(sourceIndex, 1);
            toPlateSearches.push(sourceSearch);
          }
        }

        if (targetSearch) {
          const targetIndex = toPlateSearches.findIndex(s => s.name === targetSearch.name);
          if (targetIndex !== -1) {
            toPlateSearches.splice(targetIndex, 1);
            fromPlateSearches.push(targetSearch);
          }
        }

        updatedPlateAssignments.set(fromPlate, fromPlateSearches);
        updatedPlateAssignments.set(toPlate, toPlateSearches);
      }
      // If swapping within the same plate, no need to update plateAssignments
      // as the searches remain on the same plate

      setPlateAssignments(updatedPlateAssignments);
    }

    setRandomizedPlates(updatedRandomizedPlates);
  };

  const reRandomizeSinglePlate = (
    plateIndex: number,
    searches: SearchData[],
    selectedCovariates: string[],
    selectedAlgorithm: RandomizationAlgorithm,
    keepEmptyInLastPlate: boolean,
    plateRows: number,
    plateColumns: number
  ) => {
    if (!plateAssignments) return false;

    const updatedRandomizedPlates = [...randomizedPlates];
    const currentPlate = updatedRandomizedPlates[plateIndex];

    if (!currentPlate || currentPlate.length === 0) return false;

    const plateSamples = plateAssignments.get(plateIndex) || [];
    if (plateSamples.length === 0) return false;

    if (selectedAlgorithm === 'balanced') {
      // For balanced randomization: shuffle samples within each row only
      const newPlate = currentPlate.map(row => {
        // Get all non-undefined samples in this row
        const rowSamples = row.filter(sample => sample !== undefined) as SearchData[];

        if (rowSamples.length === 0) return row;

        // Shuffle the samples in this row
        const shuffledRowSamples = [...rowSamples].sort(() => Math.random() - 0.5);

        // Create new row with shuffled samples in the same positions
        const newRow = [...row];
        let shuffleIndex = 0;

        for (let col = 0; col < newRow.length; col++) {
          if (newRow[col] !== undefined && shuffleIndex < shuffledRowSamples.length) {
            newRow[col] = shuffledRowSamples[shuffleIndex];
            shuffleIndex++;
          }
        }

        return newRow;
      });

      updatedRandomizedPlates[plateIndex] = newPlate;
    } else {
      // For other algorithms (greedy): shuffle the entire plate
      console.log(`Re-randomizing plate ${plateIndex + 1} using simple shuffling with ${plateSamples.length} samples`);

      // Create a new empty plate
      const newPlate: (SearchData | undefined)[][] = Array(plateRows)
        .fill(null)
        .map(() => Array(plateColumns).fill(undefined));

      // Shuffle all samples for this plate
      const shuffledSamples = [...plateSamples].sort(() => Math.random() - 0.5);

      // Fill the plate with shuffled samples
      let sampleIndex = 0;
      for (let row = 0; row < plateRows && sampleIndex < shuffledSamples.length; row++) {
        for (let col = 0; col < plateColumns && sampleIndex < shuffledSamples.length; col++) {
          newPlate[row][col] = shuffledSamples[sampleIndex];
          sampleIndex++;
        }
      }

      updatedRandomizedPlates[plateIndex] = newPlate;
    }

    setRandomizedPlates(updatedRandomizedPlates);
    return true;
  };

  return {
    isProcessed,
    randomizedPlates,
    plateAssignments,
    repeatedMeasuresGroups,
    repeatedMeasuresQualityMetrics,
    processRandomization,
    reRandomize,
    reRandomizeSinglePlate,
    resetRandomization,
    updatePlates,
  };
}