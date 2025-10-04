import React, { useState, useCallback, DragEvent } from 'react';
import Papa from 'papaparse';
import Plate from './components/Plate';
import { SearchData, RandomizationAlgorithm } from './types';
import { randomizeSearches, downloadCSV, BRIGHT_COLOR_PALETTE, ALGORITHM_DESCRIPTIONS, getCovariateKey, CovariateColorInfo } from './utils';

interface SummaryItem {
  combination: string;
  values: { [key: string]: string };
  count: number;
  color: string;
  useOutline: boolean;
  useStripes: boolean;
}

const App: React.FC = () => {
  // Data states
  const [searches, setSearches] = useState<SearchData[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedIdColumn, setSelectedIdColumn] = useState<string>('');
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([]);
  const [controlLabels, setControlLabels] = useState<string>('');

  // Algorithm selection
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<RandomizationAlgorithm>('balanced');
  const [keepEmptyInLastPlate, setKeepEmptyInLastPlate] = useState<boolean>(true);
  
  // Plate dimensions
  const [plateRows, setPlateRows] = useState<number>(8);
  const [plateColumns, setPlateColumns] = useState<number>(12);

  // File state
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // Processing states
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [randomizedPlates, setRandomizedPlates] = useState<(SearchData | undefined)[][][]>([]);
  const [covariateColors, setCovariateColors] = useState<{ [key: string]: CovariateColorInfo }>({});
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  
  // UI states
  const [draggedSearch, setDraggedSearch] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [compactView, setCompactView] = useState<boolean>(true);
  const [selectedCombination, setSelectedCombination] = useState<string | null>(null);

  // Helper functions
  const processSearchData = (data: any[], idColumn: string): SearchData[] => {
    return data
      .filter((row: any) => row[idColumn])
      .map((row: any) => ({
        name: row[idColumn],
        metadata: Object.keys(row)
          .filter((key) => key !== idColumn)
          .reduce((acc, key) => ({ ...acc, [key.trim()]: row[key] }), {}),
      }));
  };

  const resetProcessingState = () => {
    setIsProcessed(false);
    setSelectedCovariates([]);
    setRandomizedPlates([]);
    setCovariateColors({});
    setSummaryData([]);
    setShowSummary(false);
    setSelectedCombination(null);
  };

  const resetCovariateState = () => {
    setIsProcessed(false);
    setRandomizedPlates([]);
    setCovariateColors({});
    setSummaryData([]);
    setShowSummary(false);
    setSelectedCombination(null);
  };

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          setAvailableColumns(headers);
          setParsedData(results.data);
          
          // Auto-select reference column
          let defaultColumn = headers[0];
          if (headers.includes('search name')) {
            defaultColumn = 'search name';
          } else if (headers.includes('UW_Sample_ID')) {
            defaultColumn = 'UW_Sample_ID';
          }
          setSelectedIdColumn(defaultColumn);

          // Process data with selected ID column
          const processedSearches = processSearchData(results.data, defaultColumn);
          setSearches(processedSearches);
          resetProcessingState();
        },
      });
    }
  };

  // ID column change handler
  const handleIdColumnChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newIdColumn = event.target.value;
    setSelectedIdColumn(newIdColumn);
    
    if (parsedData.length > 0) {
      const processedSearches = processSearchData(parsedData, newIdColumn);
      setSearches(processedSearches);
      resetProcessingState();
    }
  };

  // Algorithm selection handler
  const handleAlgorithmChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newAlgorithm = event.target.value as RandomizationAlgorithm;
    setSelectedAlgorithm(newAlgorithm);
    resetCovariateState(); // Reset processing state when algorithm changes
  };

  // Empty spots option handler
  const handleKeepEmptyInLastPlateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setKeepEmptyInLastPlate(event.target.checked);
    resetCovariateState(); // Reset processing state when option changes
  };

  // Covariate selection handler
  const handleCovariateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedCovariates(selectedOptions);
    resetCovariateState();
  };

  // Control labels change handler
  const handleControlLabelsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setControlLabels(event.target.value);
    resetCovariateState();
  };

  const generateCovariateColors = useCallback(() => {
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

      return covariateColorsMap;
    }
    return {};
  }, [selectedCovariates, searches, controlLabels]);

  // Generate summary data for the panel
  const generateSummaryData = useCallback((colors: { [key: string]: CovariateColorInfo }) => {
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

      return summary;
    }
    return [];
  }, [selectedCovariates, searches]);

  // Main processing handler
  const handleProcessRandomization = () => {
    if (selectedIdColumn && selectedCovariates.length > 0 && searches.length > 0) {
      // Generate randomized plates using selected algorithm
      const plates = randomizeSearches(searches, selectedCovariates, selectedAlgorithm, keepEmptyInLastPlate, plateRows, plateColumns);
      setRandomizedPlates(plates);
      
      // Generate colors
      const colors = generateCovariateColors();
      setCovariateColors(colors);
      
      // Generate summary data
      const summary = generateSummaryData(colors);
      setSummaryData(summary);
      
      setIsProcessed(true);
    }
  };

  // Download CSV handler
  const handleDownloadCSV = () => {
    if (selectedIdColumn) {
      downloadCSV(searches, randomizedPlates, selectedIdColumn);
    }
  };

  // Re-randomization handler
  const handleReRandomize = () => {
    if (selectedIdColumn && selectedCovariates.length > 0 && searches.length > 0) {
      // Generate new randomized plates with existing colors using selected algorithm
      const plates = randomizeSearches(searches, selectedCovariates, selectedAlgorithm, keepEmptyInLastPlate, plateRows, plateColumns);
      setRandomizedPlates(plates);
    }
  };

  // Handle clicking on summary items for highlighting
  const handleSummaryItemClick = (combination: string) => {
    if (selectedCombination === combination) {
      setSelectedCombination(null); // Deselect if already selected
    } else {
      setSelectedCombination(combination);
    }
  };

  // Check if a search matches the selected combination
  const isSearchHighlighted = (search: SearchData): boolean => {
    if (!selectedCombination) return false;
    
    const searchCombination = getCovariateKey(search, selectedCovariates);
    
    return searchCombination === selectedCombination;
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragEvent<HTMLDivElement>, searchName: string) => {
    setDraggedSearch(searchName);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, plateIndex: number, rowIndex: number, columnIndex: number) => {
    event.preventDefault();
    if (!draggedSearch) return;

    const updatedRandomizedPlates = [...randomizedPlates];
    const draggedSearchData = searches.find((search) => search.name === draggedSearch);
    const targetSearchData = updatedRandomizedPlates[plateIndex][rowIndex][columnIndex];

    if (!draggedSearchData) return;

    // Find current position of dragged search
    let draggedPosition = null;
    for (let pIndex = 0; pIndex < updatedRandomizedPlates.length; pIndex++) {
      for (let rIndex = 0; rIndex < updatedRandomizedPlates[pIndex].length; rIndex++) {
        const cIndex = updatedRandomizedPlates[pIndex][rIndex].findIndex(
          (s) => s?.name === draggedSearch
        );
        if (cIndex !== -1) {
          draggedPosition = { plateIndex: pIndex, rowIndex: rIndex, columnIndex: cIndex };
          break;
        }
      }
      if (draggedPosition) break;
    }

    if (draggedPosition) {
      // Swap positions
      updatedRandomizedPlates[draggedPosition.plateIndex][draggedPosition.rowIndex][draggedPosition.columnIndex] = targetSearchData;
      updatedRandomizedPlates[plateIndex][rowIndex][columnIndex] = draggedSearchData;
      setRandomizedPlates(updatedRandomizedPlates);
    }
  };

  const canProcess = selectedIdColumn && selectedCovariates.length > 0 && searches.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.heading}>Octopus Block Randomization</h1>
        
        {/* File Upload */}
        <div style={styles.fileUploadContainer}>
          <input
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={styles.hiddenFileInput}
          />
          <label htmlFor="file-upload" style={styles.fileButton}>
            Choose File
          </label>
          {selectedFileName && (
            <span style={styles.fileName}>{selectedFileName}</span>
          )}
        </div>

        {/* Compact Form Layout */}
        {availableColumns.length > 0 && (
          <div style={styles.compactFormContainer}>
            {/* Top Row: ID Column and Covariates */}
            <div style={styles.compactRow}>
              {/* Left Column: ID Column Selection and Algorithm */}
              <div style={styles.compactColumn}>
                <label htmlFor="idColumn" style={styles.compactLabel}>Select ID Column:</label>
                <select
                  id="idColumn"
                  value={selectedIdColumn}
                  onChange={handleIdColumnChange}
                  style={styles.compactSelect}
                >
                  {availableColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>

                <label htmlFor="controlLabels" style={{ ...styles.compactLabel, marginTop: '10px' }}>Control/Reference Sample Labels (optional):</label>
                <input
                  id="controlLabels"
                  type="text"
                  value={controlLabels}
                  onChange={handleControlLabelsChange}
                  placeholder="e.g., Inter-Experiment Reference, Control, QC"
                  style={styles.compactTextInput}
                />
                <small style={styles.compactHint}>Enter labels separated by commas. Samples containing these labels will get priority colors.</small>

                <label htmlFor="algorithm" style={{ ...styles.compactLabel, marginTop: '10px' }}>Randomization Algorithm:</label>
                <select
                  id="algorithm"
                  value={selectedAlgorithm}
                  onChange={handleAlgorithmChange}
                  style={styles.compactSelect}
                >
                  <option value="greedy">Greedy Randomization</option>
                  <option value="balanced">Balanced Block Randomization</option>
                </select>
                <small style={styles.algorithmDescription}>
                  {ALGORITHM_DESCRIPTIONS[selectedAlgorithm]}
                </small>
              </div>

              {/* Right Column: Covariate Selection */}
              {searches.length > 0 && (
                <div style={styles.compactColumn}>
                  <label htmlFor="covariates" style={styles.compactLabel}>Select Covariates:</label>
                  <select
                    id="covariates"
                    multiple
                    value={selectedCovariates}
                    onChange={handleCovariateChange}
                    style={styles.compactMultiSelect}
                  >
                    {Object.keys(searches[0].metadata).map((covariate) => (
                      <option key={covariate} value={covariate}>
                        {covariate}
                      </option>
                    ))}
                  </select>
                  <small style={styles.compactHint}>Hold Ctrl/Cmd to select multiple options</small>
                  {selectedCovariates.length > 0 && (
                    <div style={styles.selectedCovariatesDisplay}>
                      <small style={styles.selectedCovariatesList}>
                        <span style={styles.selectedCovariatesLabel}>Selected: </span>
                        {selectedCovariates.join(', ')}
                      </small>
                    </div>
                  )}
                </div>
              )}
            </div>



            {/* Third Row: Balanced Algorithm Options */}
            {selectedAlgorithm === 'balanced' && (
              <div style={styles.compactRow}>
                <div style={styles.fullWidthColumn}>
                  <div style={styles.balancedOptionsContainer}>
                    {/* Checkbox and Plate Dimensions in one row */}
                    <div style={styles.optionsRow}>
                      <label style={styles.compactCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={keepEmptyInLastPlate}
                          onChange={handleKeepEmptyInLastPlateChange}
                          style={styles.checkbox}
                        />
                        Keep empty spots in last plate
                      </label>

                      <div style={styles.plateDimensionsInline}>
                        <span style={styles.dimensionLabel}>Plate Rows:</span>
                        <input
                          id="plateRows"
                          type="number"
                          min="1"
                          max="32"
                          value={plateRows}
                          onChange={(e) => {
                            setPlateRows(Math.max(1, Math.min(32, parseInt(e.target.value) || 8)));
                            resetCovariateState();
                          }}
                          style={styles.compactDimensionInput}
                        />

                        <span style={styles.dimensionLabel}>Plate Columns:</span>
                        <input
                          id="plateColumns"
                          type="number"
                          min="1"
                          max="48"
                          value={plateColumns}
                          onChange={(e) => {
                            setPlateColumns(Math.max(1, Math.min(48, parseInt(e.target.value) || 12)));
                            resetCovariateState();
                          }}
                          style={styles.compactDimensionInput}
                        />

                        <small style={styles.compactDimensionNote}>
                          Plate size: {plateRows} × {plateColumns} = {plateRows * plateColumns} wells
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <>
          {/* Process Button */}
          {searches.length > 0 && !isProcessed && (
            <button
              onClick={handleProcessRandomization}
              disabled={!canProcess}
              style={{
                ...styles.processButton,
                ...(canProcess ? {} : styles.processButtonDisabled)
              }}
            >
              Generate Randomized Plates
            </button>
          )}

          {/* Plates Visualization */}
          {isProcessed && randomizedPlates.length > 0 && (
            <>
              <div style={styles.viewControls}>
                {summaryData.length > 0 && (
                  <button
                    onClick={() => setShowSummary(!showSummary)}
                    style={styles.summaryToggle}
                  >
                    {showSummary ? '▼ Hide' : '▶ Show'} Covariate Summary ({summaryData.length} combinations)
                  </button>
                )}

                <button
                  onClick={() => setCompactView(!compactView)}
                  style={styles.controlButton}
                >
                  {compactView ? 'Full Size View' : 'Compact View'}
                </button>

                <button onClick={handleReRandomize} style={styles.controlButton}>
                  Re-randomize
                </button>

                <button onClick={handleDownloadCSV} style={styles.downloadButton}>
                  Download CSV
                </button>
              </div>

              {/* Summary Panel */}
              {summaryData.length > 0 && showSummary && (
                <div style={styles.summaryContainer}>
                  <div style={styles.summaryPanel}>
                    <div style={styles.summaryGrid}>
                      {summaryData.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            ...styles.summaryItem,
                            ...(selectedCombination === item.combination ? styles.summaryItemSelected : {}),
                            cursor: 'pointer'
                          }}
                          onClick={() => handleSummaryItemClick(item.combination)}
                        >
                          <div style={styles.summaryHeader}>
                            <div
                              style={{
                                ...styles.colorIndicator,
                                backgroundColor: item.useOutline ? 'transparent' : item.color,
                                ...(item.useStripes && { background: `repeating-linear-gradient(45deg, ${item.color}, ${item.color} 2px, transparent 2px, transparent 4px)` }),
                                border: item.useOutline ? `3px solid ${item.color}` : styles.colorIndicator.border
                              }}
                            />
                            <span style={styles.summaryCount}>
                              {item.count}
                            </span>
                          </div>
                          <div style={styles.summaryDetails}>
                            {Object.entries(item.values).map(([covariate, value]) => (
                              <div key={covariate} style={styles.covariateDetail}>
                                <strong>{covariate}:</strong> {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={compactView ? styles.compactPlatesContainer : styles.platesContainer}>
                {randomizedPlates.map((plate, plateIndex) => (
                  <div key={plateIndex} style={compactView ? styles.compactPlateWrapper : styles.plateWrapper}>
                    <Plate
                      plateIndex={plateIndex}
                      rows={plate}
                      covariateColors={covariateColors}
                      selectedCovariates={selectedCovariates}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={(event, rowIndex, columnIndex) => handleDrop(event, plateIndex, rowIndex, columnIndex)}
                      compact={compactView}
                      highlightFunction={isSearchHighlighted}
                      numColumns={plateColumns}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
    boxSizing: 'border-box' as const,
  },
  fileUploadContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '25px',
  },
  fileName: {
    fontSize: '14px',
    color: '#333',
    fontWeight: 'normal',
    wordBreak: 'break-all' as const,
  },
  content: {
    width: '100%',
    maxWidth: '1600px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '30px',
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  heading: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#333',
    textAlign: 'center' as const,
  },
  hiddenFileInput: {
    display: 'none',
  },
  fileButton: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    textDecoration: 'none',
    transition: 'background-color 0.3s ease',
  },
  selectionContainer: {
    width: '100%',
    maxWidth: '900px',
    marginBottom: '25px',
  },
  selectionRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '30px',
    width: '100%',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  selectionGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1px',
    flex: '1',
    minWidth: '250px',
  },
  covariateSection: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  controlLabelsSection: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    marginTop: '20px',
  },
  select: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    width: '100%',
    backgroundColor: '#fff',
  },
  multiSelect: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    width: '100%',
    minHeight: '120px',
    backgroundColor: '#fff',
  },
  textInput: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    width: '100%',
    backgroundColor: '#fff',
  },
  hint: {
    color: '#666',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  algorithmDescription: {
    color: '#666',
    fontSize: '11px',
    fontStyle: 'italic',
    textAlign: 'left' as const,
    lineHeight: '1.3',
    marginTop: '2px',
  },
  checkboxContainer: {
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'center',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#333',
    cursor: 'pointer',
  },
  checkbox: {
    marginRight: '6px',
    cursor: 'pointer',
  },
  plateDimensionsContainer: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
  },
  dimensionGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '12px',
  },
  dimensionInput: {
    width: '60px',
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  dimensionNote: {
    display: 'block',
    textAlign: 'center' as const,
    color: '#666',
    fontSize: '11px',
    fontStyle: 'italic',
    marginTop: '5px',
  },
  processButton: {
    marginBottom: '30px',
    padding: '15px 30px',
    fontSize: '16px',
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s ease',
  },
  processButtonDisabled: {
    backgroundColor: '#ccc',
    color: '#666',
    cursor: 'not-allowed',
  },
  summaryContainer: {
    width: '90%',
    marginBottom: '20px',
  },
  summaryToggle: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s ease',
  },
  summaryPanel: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '15px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1px',
  },
  summaryItem: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'all 0.2s ease',
  },
  summaryItemSelected: {
    backgroundColor: '#e3f2fd',
    border: '2px solid #2196f3',
    boxShadow: '0 2px 4px rgba(33, 150, 243, 0.3)',
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '6px',
    gap: '8px',
  },
  colorIndicator: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #fff',
    boxShadow: '0 0 0 1px #ddd',
  },
  summaryCount: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  summaryDetails: {
    fontSize: '12px',
    color: '#666',
  },
  covariateDetail: {
    marginBottom: '2px',
  },
  viewControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
  },
  controlButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s ease',
  },
  platesContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    gap: '25px',
    width: '100%',
    marginBottom: '30px',
  },
  plateWrapper: {
    margin: '0',
  },
  compactPlatesContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '15px',
    width: '100%',
    marginBottom: '30px',
    padding: '0 10px',
  },
  compactPlateWrapper: {
    margin: '0',
    display: 'flex',
    justifyContent: 'center',
  },
  downloadButton: {
    padding: '12px 25px',
    fontSize: '16px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s ease',
  },
  // Compact form styles
  compactFormContainer: {
    width: '100%',
    maxWidth: '900px',
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  },
  compactRow: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
  },
  compactColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  fullWidthColumn: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  compactLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  compactSelect: {
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#fff',
  },
  compactMultiSelect: {
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#fff',
    minHeight: '150px',
    maxHeight: '150px',
  },
  compactTextInput: {
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#fff',
  },
  compactHint: {
    fontSize: '11px',
    color: '#666',
    fontStyle: 'italic',
  },
  balancedOptionsContainer: {
    marginTop: '0px',
    padding: '5px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
  },
  optionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap' as const,
  },
  compactCheckboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#333',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  plateDimensionsInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  dimensionLabel: {
    fontSize: '12px',
    color: '#333',
    whiteSpace: 'nowrap' as const,
  },
  compactDimensionInput: {
    width: '50px',
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  compactDimensionNote: {
    fontSize: '11px',
    color: '#666',
    fontStyle: 'italic',
    whiteSpace: 'nowrap' as const,
  },
  selectedCovariatesDisplay: {
    marginTop: '0px',
    padding: '0px',
  },
  selectedCovariatesLabel: {
    fontWeight: 'bold',
    color: '#616161ff',
  },
  selectedCovariatesList: {
    fontSize: '11px',
    color: '#333',
    lineHeight: '1.4',
  },
  selectedCovariateItem: {
    fontWeight: '500',
  },
};

export default App;