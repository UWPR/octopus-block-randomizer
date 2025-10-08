import { useState } from 'react';
import { SearchData, RandomizationAlgorithm } from '../types';
import { randomizeSearches } from '../utils';

export function useRandomization() {
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [randomizedPlates, setRandomizedPlates] = useState<(SearchData | undefined)[][][]>([]);
  const [plateAssignments, setPlateAssignments] = useState<Map<number, SearchData[]> | undefined>(undefined);

  const processRandomization = (
    searches: SearchData[],
    selectedCovariates: string[],
    selectedAlgorithm: RandomizationAlgorithm,
    keepEmptyInLastPlate: boolean,
    plateRows: number,
    plateColumns: number
  ) => {
    if (searches.length > 0 && selectedCovariates.length > 0) {
      const result = randomizeSearches(
        searches,
        selectedCovariates,
        selectedAlgorithm,
        keepEmptyInLastPlate,
        plateRows,
        plateColumns
      );
      setRandomizedPlates(result.plates);
      setPlateAssignments(result.plateAssignments);
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
    plateColumns: number
  ) => {
    if (searches.length > 0 && selectedCovariates.length > 0) {
      const result = randomizeSearches(
        searches,
        selectedCovariates,
        selectedAlgorithm,
        keepEmptyInLastPlate,
        plateRows,
        plateColumns
      );
      setRandomizedPlates(result.plates);
      setPlateAssignments(result.plateAssignments);
    }
  };

  const resetRandomization = () => {
    setIsProcessed(false);
    setRandomizedPlates([]);
    setPlateAssignments(undefined);
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

  return {
    isProcessed,
    randomizedPlates,
    plateAssignments,
    processRandomization,
    reRandomize,
    resetRandomization,
    updatePlates,
  };
}