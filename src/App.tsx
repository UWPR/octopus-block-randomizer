import React, { useState, useCallback, DragEvent } from 'react';
import Papa from 'papaparse';
import Plate from './components/Plate';
import { SearchData } from './types';
import { randomizeSearches, downloadCSV, BRIGHT_COLOR_PALETTE } from './utils';

interface SummaryItem {
  combination: string;
  values: { [key: string]: string };
  count: number;
  color: string;
}

const App: React.FC = () => {
  // Data states
  const [searches, setSearches] = useState<SearchData[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedReferenceColumn, setSelectedReferenceColumn] = useState<string>('');
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([]);
  
  // Processing states
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [randomizedPlates, setRandomizedPlates] = useState<(SearchData | undefined)[][][]>([]);
  const [covariateColors, setCovariateColors] = useState<{ [key: string]: string }>({});
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  
  // UI states
  const [draggedSearch, setDraggedSearch] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  // Helper functions
  const processSearchData = (data: any[], referenceColumn: string): SearchData[] => {
    return data
      .filter((row: any) => row[referenceColumn])
      .map((row: any) => ({
        name: row[referenceColumn],
        metadata: Object.keys(row)
          .filter((key) => key !== referenceColumn)
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
  };

  const resetCovariateState = () => {
    setIsProcessed(false);
    setRandomizedPlates([]);
    setCovariateColors({});
    setSummaryData([]);
    setShowSummary(false);
  };

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
          setSelectedReferenceColumn(defaultColumn);

          // Process data with selected reference column
          const processedSearches = processSearchData(results.data, defaultColumn);
          setSearches(processedSearches);
          resetProcessingState();
        },
      });
    }
  };

  // Reference column change handler
  const handleReferenceColumnChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newReferenceColumn = event.target.value;
    setSelectedReferenceColumn(newReferenceColumn);
    
    if (parsedData.length > 0) {
      const processedSearches = processSearchData(parsedData, newReferenceColumn);
      setSearches(processedSearches);
      resetProcessingState();
    }
  };

  // Covariate selection handler
  const handleCovariateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedCovariates(selectedOptions);
    resetCovariateState();
  };

  const generateCovariateColors = useCallback(() => {
    if (selectedCovariates.length > 0 && searches.length > 0) {
      const covariateValues = new Set(
        selectedCovariates.flatMap((covariate) =>
          searches.map((search) => search.metadata[covariate])
        )
      );

      const covariateColorsMap: { [key: string]: string } = {};
      let colorIndex = 0;

      covariateValues.forEach((value) => {
        covariateColorsMap[value] = BRIGHT_COLOR_PALETTE[colorIndex % BRIGHT_COLOR_PALETTE.length];
        colorIndex += 1;
      });

      return covariateColorsMap;
    }
    return {};
  }, [selectedCovariates, searches]);

  // Generate summary data for the panel
  const generateSummaryData = useCallback((colors: { [key: string]: string }) => {
    if (selectedCovariates.length > 0 && searches.length > 0) {
      // Group searches by their covariate combinations
      const combinationsMap = new Map<string, {
        values: { [key: string]: string };
        count: number;
      }>();

      searches.forEach((search) => {
        const covariateValues: { [key: string]: string } = {};
        selectedCovariates.forEach((covariate) => {
          covariateValues[covariate] = search.metadata[covariate] || 'N/A';
        });
        
        const combinationKey = JSON.stringify(covariateValues);
        
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
      const summary: SummaryItem[] = Array.from(combinationsMap.entries()).map(([key, data]) => {
        // Get color from the first covariate value that has a color assigned
        let assignedColor = '#cccccc'; // default gray
        for (const covariate of selectedCovariates) {
          const value = data.values[covariate];
          if (colors[value]) {
            assignedColor = colors[value];
            break;
          }
        }

        return {
          combination: selectedCovariates.map(cov => `${cov}: ${data.values[cov]}`).join(', '),
          values: data.values,
          count: data.count,
          color: assignedColor
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
    if (selectedReferenceColumn && selectedCovariates.length > 0 && searches.length > 0) {
      // Generate randomized plates
      const plates = randomizeSearches(searches, selectedCovariates);
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
    if (selectedReferenceColumn) {
      downloadCSV(searches, randomizedPlates, selectedReferenceColumn);
    }
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

  const canProcess = selectedReferenceColumn && selectedCovariates.length > 0 && searches.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.heading}>Block Randomization</h1>
        
        {/* File Upload */}
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          style={styles.fileInput} 
        />
        
        {/* Reference Column and Covariate Selection */}
        {availableColumns.length > 0 && (
          <div style={styles.selectionRow}>
            {/* Reference Column Selection */}
            <div style={styles.selectionGroup}>
              <label htmlFor="referenceColumn">Select Reference/ID Column:</label>
              <select 
                id="referenceColumn" 
                value={selectedReferenceColumn} 
                onChange={handleReferenceColumnChange}
                style={styles.select}
              >
                {availableColumns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Covariate Selection */}
            {searches.length > 0 && (
              <div style={styles.selectionGroup}>
                <label htmlFor="covariates">Select Covariates:</label>
                <select 
                  id="covariates" 
                  multiple 
                  value={selectedCovariates} 
                  onChange={handleCovariateChange}
                  style={styles.multiSelect}
                >
                  {Object.keys(searches[0].metadata).map((covariate) => (
                    <option key={covariate} value={covariate}>
                      {covariate}
                    </option>
                  ))}
                </select>
                <small style={styles.hint}>Hold Ctrl/Cmd to select multiple options</small>
              </div>
            )}
          </div>
        )}
        
        {/* Process Button */}
        {canProcess && !isProcessed && (
          <button onClick={handleProcessRandomization} style={styles.processButton}>
            Generate Randomized Plates
          </button>
        )}
        
        {/* Summary Panel */}
        {isProcessed && summaryData.length > 0 && (
          <div style={styles.summaryContainer}>
            <button 
              onClick={() => setShowSummary(!showSummary)}
              style={styles.summaryToggle}
            >
              {showSummary ? '▼ Hide' : '▶ Show'} Covariate Summary ({summaryData.length} combinations)
            </button>
            
            {showSummary && (
              <div style={styles.summaryPanel}>
                <div style={styles.summaryGrid}>
                  {summaryData.map((item, index) => (
                    <div key={index} style={styles.summaryItem}>
                      <div style={styles.summaryHeader}>
                        <div 
                          style={{
                            ...styles.colorIndicator,
                            backgroundColor: item.color
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
            )}
          </div>
        )}
        
        {/* Plates Visualization */}
        {isProcessed && randomizedPlates.length > 0 && (
          <div style={styles.platesContainer}>
            {randomizedPlates.map((plate, plateIndex) => (
              <div key={plateIndex} style={styles.plateWrapper}>
                <Plate
                  plateIndex={plateIndex}
                  rows={plate}
                  covariateColors={covariateColors}
                  selectedCovariates={selectedCovariates}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={(event, rowIndex, columnIndex) => handleDrop(event, plateIndex, rowIndex, columnIndex)}
                />
              </div>
            ))}
          </div>
        )}
        
        {/* Download Button */}
        {isProcessed && randomizedPlates.length > 0 && (
          <button onClick={handleDownloadCSV} style={styles.downloadButton}>
            Download CSV
          </button>
        )}
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
  fileInput: {
    marginBottom: '25px',
    padding: '10px',
    border: '2px dashed #ccc',
    borderRadius: '6px',
    backgroundColor: '#fafafa',
    cursor: 'pointer',
  },
  selectionRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '30px',
    width: '100%',
    maxWidth: '700px',
    marginBottom: '25px',
    flexWrap: 'wrap' as const,
  },
  selectionGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
    flex: '1',
    minWidth: '250px',
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
  hint: {
    color: '#666',
    fontSize: '12px',
    fontStyle: 'italic',
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
  summaryContainer: {
    width: '100%',
    maxWidth: '900px',
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
    marginBottom: '10px',
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
    gap: '10px',
  },
  summaryItem: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
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
};

export default App;