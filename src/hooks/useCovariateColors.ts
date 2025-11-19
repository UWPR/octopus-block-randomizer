import { useState, useCallback } from 'react';
import { SearchData, SummaryItem, CovariateColorInfo } from '../utils/types';
import { getCovariateKey, getTextColorForBackground } from '../utils/utils';
import { BRIGHT_COLOR_PALETTE, QC_COLOR_PALETTE } from '../utils/configs';

export function useCovariateColors() {
  const [covariateColors, setCovariateColors] = useState<{ [key: string]: CovariateColorInfo }>({});
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);

  // Helper function to parse control labels
  const parseControlLabels = useCallback((controlLabels: string): string[] => {
    return controlLabels
      .split(',')
      .map(label => label.trim())
      .filter(label => label.length > 0);
  }, []);

  // Helper function to determine if a combination is a control
  const isControlCombination = useCallback((combination: string, controlLabelsList: string[]): boolean => {
    return controlLabelsList.length > 0 && controlLabelsList.some(controlLabel =>
      combination.toLowerCase().includes(controlLabel.toLowerCase())
    );
  }, []);

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

      // Parse control labels
      const controlLabelsList = parseControlLabels(controlLabels);

      // Separate control combinations from regular combinations
      const controlCombinations: string[] = [];
      const regularCombinations: string[] = [];

      Array.from(combinationCounts.keys()).forEach((combination) => {
        if (isControlCombination(combination, controlLabelsList)) {
          controlCombinations.push(combination);
        } else {
          regularCombinations.push(combination);
        }
      });

      // Sort control combinations by count (descending)
      controlCombinations.sort((a, b) => (combinationCounts.get(b) || 0) - (combinationCounts.get(a) || 0));

      // Sort regular combinations by count (descending)
      regularCombinations.sort((a, b) => (combinationCounts.get(b) || 0) - (combinationCounts.get(a) || 0));

      // Assign colors in the new order
      const covariateColorsMap: { [key: string]: CovariateColorInfo } = {};

      // debugger; // 🔍 BREAKPOINT: Check QC color assignment logic
      controlCombinations.forEach((combination, colorIndex) => {
        const paletteIndex = colorIndex % QC_COLOR_PALETTE.length;
        const cycle = Math.floor(colorIndex / QC_COLOR_PALETTE.length);
        const color = QC_COLOR_PALETTE[paletteIndex];

        covariateColorsMap[combination] = {
          color: color,
          useOutline: cycle === 1, // Second cycle (25-48)
          useStripes: cycle === 2,  // Third cycle (49-72)
          textColor: getTextColorForBackground(color) // Pre-calculate text color
        };
      });

      regularCombinations.forEach((combination, colorIndex) => {
        const paletteIndex = colorIndex % BRIGHT_COLOR_PALETTE.length;
        const cycle = Math.floor(colorIndex / BRIGHT_COLOR_PALETTE.length);
        const color = BRIGHT_COLOR_PALETTE[paletteIndex];

        covariateColorsMap[combination] = {
          color: color,
          useOutline: cycle === 1, // Second cycle (25-48)
          useStripes: cycle === 2,  // Third cycle (49-72)
          textColor: getTextColorForBackground(color) // Pre-calculate text color
        };
      });

      setCovariateColors(covariateColorsMap);
      return covariateColorsMap;
    }
    return {};
  }, [parseControlLabels, isControlCombination]);

  // Generate summary data for the panel
  const generateSummaryData = useCallback((
    colors: { [key: string]: CovariateColorInfo },
    searches: SearchData[],
    selectedCovariates: string[],
    controlLabels: string
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
        const colorInfo = colors[combinationKey] || {
          color: '#cccccc',
          useOutline: false,
          useStripes: false,
          textColor: '#000' // Default gray is light, so use black text
        };
        return {
          combination: combinationKey, // Use the same key format as colors
          values: data.values,
          count: data.count,
          color: colorInfo.color,
          useOutline: colorInfo.useOutline,
          useStripes: colorInfo.useStripes
        };
      });

      // Parse control labels for sorting
      const controlLabelsList = parseControlLabels(controlLabels);

      // Sort: controls first, then by count (descending), then by combination name
      summary.sort((a, b) => {
        // Determine if combinations are controls
        const aIsControl = isControlCombination(a.combination, controlLabelsList);
        const bIsControl = isControlCombination(b.combination, controlLabelsList);

        // Controls come first
        if (aIsControl && !bIsControl) return -1;
        if (!aIsControl && bIsControl) return 1;

        // Within same type (both controls or both regular), sort by count descending
        if (b.count !== a.count) return b.count - a.count;
        
        // If counts are equal, sort by combination name
        return a.combination.localeCompare(b.combination);
      });

      setSummaryData(summary);
      return summary;
    }
    return [];
  }, [parseControlLabels, isControlCombination]);

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