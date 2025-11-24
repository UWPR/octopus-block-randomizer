import { useState, useCallback } from 'react';
import { SearchData, SummaryItem, CovariateColorInfo } from '../utils/types';
import { getCovariateKey, getTextColorForBackground, sortCombinationsByCountAndName } from '../utils/utils';
import { BRIGHT_COLOR_PALETTE, QC_COLOR_PALETTE } from '../utils/configs';

export function useCovariateColors() {
  const [covariateColors, setCovariateColors] = useState<{ [key: string]: CovariateColorInfo }>({});
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);

  const generateCovariateColors = useCallback((
    searches: SearchData[],
    selectedCovariates: string[],
    controlColumn?: string,
    selectedControlValues?: string[]
  ) => {
    if (selectedCovariates.length > 0 && searches.length > 0) {
      // Group searches by covariate combinations and count them
      const combinationCounts = new Map<string, number>();
      searches.forEach((search) => {
        const combination = getCovariateKey(search, selectedCovariates);
        combinationCounts.set(combination, (combinationCounts.get(combination) || 0) + 1);
      });

      // Separate control combinations from regular combinations
      const controlCombinations: string[] = [];
      const regularCombinations: string[] = [];

      Array.from(combinationCounts.keys()).forEach((combination) => {
        // Check if any search with this combination is marked as control
        const hasControlSample = searches.some(search =>
          getCovariateKey(search, selectedCovariates) === combination && search.isControl
        );

        if (hasControlSample) {
          controlCombinations.push(combination);
        } else {
          regularCombinations.push(combination);
        }
      });

      // Sort control combinations by count (descending), then alphabetically
      const sortedControlCombinations = sortCombinationsByCountAndName(controlCombinations, combinationCounts);

      // Sort regular combinations by count (descending), then alphabetically
      const sortedRegularCombinations = sortCombinationsByCountAndName(regularCombinations, combinationCounts);

      // Assign colors in the new order
      const covariateColorsMap: { [key: string]: CovariateColorInfo } = {};

      // debugger; // 🔍 BREAKPOINT: Check QC color assignment logic
      sortedControlCombinations.forEach((combination, colorIndex) => {
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

      sortedRegularCombinations.forEach((combination, colorIndex) => {
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
  }, []);

  // Generate summary data for the panel
  const generateSummaryData = useCallback((
    colors: { [key: string]: CovariateColorInfo },
    searches: SearchData[],
    selectedCovariates: string[],
    controlColumn?: string,
    selectedControlValues?: string[]
  ) => {
    if (selectedCovariates.length > 0 && searches.length > 0) {
      // Group searches by their covariate combinations using getCovariateKey
      const combinationsMap = new Map<string, {
        values: { [key: string]: string };
        count: number;
        controlColumnValue?: string;
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
          // Get control column value if control column is selected
          let controlValue: string | undefined = undefined;
          if (controlColumn) {
            controlValue = search.metadata[controlColumn] || undefined;
          }

          combinationsMap.set(combinationKey, {
            values: covariateValues,
            count: 1,
            controlColumnValue: controlValue
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
          useStripes: colorInfo.useStripes,
          controlColumnValue: data.controlColumnValue
        };
      });

      // Separate controls and regular combinations for sorting
      const controlSummary: SummaryItem[] = [];
      const regularSummary: SummaryItem[] = [];

      summary.forEach(item => {
        const isControl = searches.some(search =>
          getCovariateKey(search, selectedCovariates) === item.combination && search.isControl
        );
        if (isControl) {
          controlSummary.push(item);
        } else {
          regularSummary.push(item);
        }
      });

      // Create count maps for sorting
      const controlCounts = new Map(controlSummary.map(item => [item.combination, item.count]));
      const regularCounts = new Map(regularSummary.map(item => [item.combination, item.count]));

      // Sort each group using the common helper
      const sortedControlKeys = sortCombinationsByCountAndName(
        controlSummary.map(item => item.combination),
        controlCounts
      );
      const sortedRegularKeys = sortCombinationsByCountAndName(
        regularSummary.map(item => item.combination),
        regularCounts
      );

      // Rebuild summary in sorted order: controls first, then regular
      const sortedSummary: SummaryItem[] = [];
      sortedControlKeys.forEach(key => {
        const item = controlSummary.find(s => s.combination === key);
        if (item) sortedSummary.push(item);
      });
      sortedRegularKeys.forEach(key => {
        const item = regularSummary.find(s => s.combination === key);
        if (item) sortedSummary.push(item);
      });

      setSummaryData(sortedSummary);
      return sortedSummary;

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