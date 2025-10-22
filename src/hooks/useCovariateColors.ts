import { useState, useCallback } from 'react';
import { SearchData, SummaryItem, CovariateColorInfo } from '../utils/types';
import { BRIGHT_COLOR_PALETTE, getCovariateKey } from '../utils/utils';

export function useCovariateColors() {
  const [covariateColors, setCovariateColors] = useState<{ [key: string]: CovariateColorInfo }>({});
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);

  const generateCovariateColors = useCallback((
    searches: SearchData[],
    selectedCovariates: string[],
    controlLabels: string
  ) => {
    if (selectedCovariates.length > 0 && searches.length > 0) {
      // Group searches by covariate combinations and count them
      const combinationCounts = new Map<string, number>();
      searches.forEach((search) => {
        const combination = getCovariateKey(search, selectedCovariates);
        combinationCounts.set(combination, (combinationCounts.get(combination) || 0) + 1);
      });

      // Parse control labels (split by comma and trim)
      const controlLabelsList = controlLabels
        .split(',')
        .map(label => label.trim())
        .filter(label => label.length > 0);

      // Separate control combinations from regular combinations
      const controlCombinations: string[] = [];
      const regularCombinations: string[] = [];

      Array.from(combinationCounts.keys()).forEach((combination) => {
        const isControl = controlLabelsList.length > 0 && controlLabelsList.some(controlLabel =>
          combination.toLowerCase().includes(controlLabel.toLowerCase())
        );

        if (isControl) {
          controlCombinations.push(combination);
        } else {
          regularCombinations.push(combination);
        }
      });

      // Sort control combinations by count (descending)
      controlCombinations.sort((a, b) => (combinationCounts.get(b) || 0) - (combinationCounts.get(a) || 0));

      // Sort regular combinations by count (descending)
      regularCombinations.sort((a, b) => (combinationCounts.get(b) || 0) - (combinationCounts.get(a) || 0));

      // Combine arrays: controls first, then regular combinations
      const sortedCombinations = [...controlCombinations, ...regularCombinations];

      // Assign colors in the new order
      const covariateColorsMap: { [key: string]: CovariateColorInfo } = {};

      sortedCombinations.forEach((combination, colorIndex) => {
        const paletteIndex = colorIndex % BRIGHT_COLOR_PALETTE.length;
        const cycle = Math.floor(colorIndex / BRIGHT_COLOR_PALETTE.length);

        covariateColorsMap[combination] = {
          color: BRIGHT_COLOR_PALETTE[paletteIndex],
          useOutline: cycle === 1, // Second cycle (25-48)
          useStripes: cycle === 2   // Third cycle (49-72)
        };
      });

      setCovariateColors(covariateColorsMap);
      return covariateColorsMap;
    }
    return {};
  }, []);

  // Generate summary data for the panel
  const generateSummaryData = useCallback((
    colors: { [key: string]: CovariateColorInfo },
    searches: SearchData[],
    selectedCovariates: string[]
  ) => {
    if (selectedCovariates.length > 0 && searches.length > 0) {
      // Group searches by their covariate combinations using getCovariateKey
      const combinationsMap = new Map<string, {
        values: { [key: string]: string };
        count: number;
      }>();

      searches.forEach((search) => {
        const covariateValues: { [key: string]: string } = {};
        selectedCovariates.forEach((covariate) => {
          covariateValues[covariate] = search.metadata[covariate] || 'N/A';
        });

        const combinationKey = getCovariateKey(search, selectedCovariates);

        if (combinationsMap.has(combinationKey)) {
          const existing = combinationsMap.get(combinationKey)!;
          existing.count++;
        } else {
          combinationsMap.set(combinationKey, {
            values: covariateValues,
            count: 1
          });
        }
      });

      // Convert to summary data with colors
      const summary: SummaryItem[] = Array.from(combinationsMap.entries()).map(([combinationKey, data]) => {
        const colorInfo = colors[combinationKey] || { color: '#cccccc', useOutline: false, useStripes: false };
        return {
          combination: combinationKey, // Use the same key format as colors
          values: data.values,
          count: data.count,
          color: colorInfo.color,
          useOutline: colorInfo.useOutline,
          useStripes: colorInfo.useStripes
        };
      });

      // Sort by count (descending) then by combination name
      summary.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.combination.localeCompare(b.combination);
      });

      setSummaryData(summary);
      return summary;
    }
    return [];
  }, []);

  const resetColors = () => {
    setCovariateColors({});
    setSummaryData([]);
  };

  return {
    covariateColors,
    summaryData,
    generateCovariateColors,
    generateSummaryData,
    resetColors,
  };
}