import { SearchData } from './types';
import Papa from 'papaparse';

// Bright color palette with 24 distinct colors in 4 randomized subgroups
export const BRIGHT_COLOR_PALETTE = [
  // Subgroup 1
  '#FF69B4', // Hot Pink
  '#0000FF', // Pure Blue
  '#FF8000', // Pure Orange
  '#9370DB', // Medium Purple
  '#006400', // Dark Forest Green
  '#008B8B', // Dark Cyan

  // Subgroup 2
  '#FF0000', // Pure Red
  '#87CEEB', // Sky Blue
  '#800080', // Purple
  '#FFA500', // Orange
  '#32CD32', // Lime Green
  '#C0C0C0', // Silver

  // Subgroup 3
  '#F08080', // Light Coral
  '#4169E1', // Royal Blue
  '#FF1493', // Deep Pink
  '#FFFF00', // Pure Yellow
  '#98FB98', // Pale Green
  '#40E0D0', // Turquoise

  // Subgroup 4
  '#FF4500', // Orange Red
  '#8000FF', // Pure Purple
  '#BA55D3', // Medium Orchid
  '#B8860B', // Dark Gold
  '#20B2AA', // Light Sea Green
  '#DDA0DD'  // Plum
];

function generatePermutations(array: SearchData[]): (SearchData | undefined)[][] {
    if (array.length <= 1) return [array];
    const perms: (SearchData | undefined)[][] = [];
    const [first, ...rest] = array;
    for (const perm of generatePermutations(rest)) {
      for (let i = 0; i <= perm.length; i++) {
        const start = perm.slice(0, i);
        const end = perm.slice(i);
        perms.push([...start, first, ...end]);
      }
    }
    return perms;
  }
  
  function calculateDissimilarityScore(row: (SearchData | undefined)[], orderedRows: (SearchData | undefined)[][], selectedCovariates: string[]): number {
    let score = 0;
    for (let i = 0; i < row.length; i++) {
      orderedRows.forEach((orderedRow: (SearchData | undefined)[]) => {
        if (i < orderedRow.length && row[i] && orderedRow[i]) {
          const dissimilarity = selectedCovariates.some(covariate => 
            row[i]!.metadata[covariate] !== orderedRow[i]!.metadata[covariate]);
          if (dissimilarity) score++;
        }
      });
    }
    return score;
  }

  export function randomizeSearches(searches: SearchData[], selectedCovariates: string[]): (SearchData | undefined)[][][] {
    const platesNeeded = Math.ceil(searches.length / 96);
    let plates = Array.from({ length: platesNeeded }, () =>
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
    );

    let shuffledSearches = shuffleArray([...searches]);

    // Shuffle an array in-place and return it
    function shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function searchCanBePlaced(search: SearchData, row: (SearchData | undefined)[], tolerance: number): boolean {
        const searchCovariates = selectedCovariates.map(cov => search.metadata[cov]);
        let duplicateCount = 0;

        for (const existingSearch of row) {
            if (existingSearch === undefined) continue;
            const existingSearchCovariates = selectedCovariates.map(cov => existingSearch.metadata[cov]);
            if (JSON.stringify(searchCovariates) === JSON.stringify(existingSearchCovariates)) {
                duplicateCount++;
            }
        }

        return duplicateCount <= tolerance;
    }

    // Place searches with increasing tolerance
    for (const search of shuffledSearches) {
        let placed = false;
        let tolerance = 0;

        while (!placed) {
            for (let p = 0; p < plates.length && !placed; p++) {
                for (let r = 0; r < plates[p].length && !placed; r++) {
                    if (searchCanBePlaced(search, plates[p][r], tolerance) && plates[p][r].includes(undefined)) {
                        const indexToPlace = plates[p][r].indexOf(undefined);
                        plates[p][r][indexToPlace] = search;
                        placed = true;
                    }
                }
            }

            if (!placed) tolerance++;
        }
    }

    //maximizeDissimilarity(plates, selectedCovariates);

    // Shuffle the order of searches within each row after all searches have been assigned
    for (let p = 0; p < plates.length; p++) {
        for (let r = 0; r < plates[p].length; r++) {
            plates[p][r] = shuffleArray(plates[p][r]);
        }
    }

    return plates;
}

function maximizeDissimilarity(plates: (SearchData | undefined)[][][], selectedCovariates: string[]): void {
    plates.forEach((plate: (SearchData | undefined)[][]) => {
      let orderedRows: (SearchData | undefined)[][] = [];
  
      const startIndex = Math.floor(Math.random() * plate.length);
      orderedRows.push(...plate.splice(startIndex, 1));
  
      while (plate.length > 0) {
        let bestScore = -Infinity;
        let bestRow: (SearchData | undefined)[] | null = null;
        let bestRowIndex = -1;
  
        plate.forEach((row: (SearchData | undefined)[], rowIndex: number) => {
          const permutations = generatePermutations(row.filter(item => item !== undefined) as SearchData[]);
          permutations.forEach(permutation => {
            const score = calculateDissimilarityScore(permutation, orderedRows, selectedCovariates);
            if (score > bestScore) {
              bestScore = score;
              bestRow = permutation;
              bestRowIndex = rowIndex;
            }
          });
        });
  
        if (bestRow !== null) {
          orderedRows.push(bestRow);
          plate.splice(bestRowIndex, 1);
        }
      }
  
      plate.push(...orderedRows.map(row => [...row, ...Array(12 - row.length).fill(undefined)]));
    });
  }


// Updated to accept referenceColumn parameter instead of hardcoding "search name"
export function downloadCSV(searches: SearchData[], randomizedPlates: (SearchData | undefined)[][][], referenceColumn: string) {
    const csv = Papa.unparse(
      searches.map((search) => ({
        [referenceColumn]: search.name, // Use the selected reference column name
        ...search.metadata,
        plate: getPlateNumber(search.name, randomizedPlates),
        row: getRowName(search.name, randomizedPlates),
        column: getColumnNumber(search.name, randomizedPlates),
      })),
      { header: true }
    );
  
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'randomized_searches.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  export function getPlateNumber(searchName: string, randomizedPlates: (SearchData | undefined)[][][]) {
    for (let plateIndex = 0; plateIndex < randomizedPlates.length; plateIndex++) {
      const plate = randomizedPlates[plateIndex];
      for (let rowIndex = 0; rowIndex < plate.length; rowIndex++) {
        const row = plate[rowIndex];
        if (row.find((search) => search?.name === searchName)) {
          return plateIndex + 1;
        }
      }
    }
    return '';
  };

  export function getRowName(searchName: string, randomizedPlates: (SearchData | undefined)[][][]) {
    for (let plateIndex = 0; plateIndex < randomizedPlates.length; plateIndex++) {
      const plate = randomizedPlates[plateIndex];
      for (let rowIndex = 0; rowIndex < plate.length; rowIndex++) {
        const row = plate[rowIndex];
        if (row.find((search) => search?.name === searchName)) {
          return String.fromCharCode(65 + rowIndex);
        }
      }
    }
    return '';
  };

  export function getColumnNumber(searchName: string, randomizedPlates: (SearchData | undefined)[][][]) {
    for (let plateIndex = 0; plateIndex < randomizedPlates.length; plateIndex++) {
      const plate = randomizedPlates[plateIndex];
      for (let rowIndex = 0; rowIndex < plate.length; rowIndex++) {
        const row = plate[rowIndex];
        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
          if (row[columnIndex]?.name === searchName) {
            return (columnIndex + 1).toString().padStart(2, '0');
          }
        }
      }
    }
    return '';
  };