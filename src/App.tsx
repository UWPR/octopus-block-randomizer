import React, { useState, useCallback, useEffect, DragEvent } from 'react';
import FileUploadSection from './components/FileUploadSection';
import ConfigurationForm from './components/ConfigurationForm';
import SummaryPanel from './components/SummaryPanel';
import PlateDetailsModal from './components/PlateDetailsModal';
import PlatesGrid from './components/PlatesGrid';
import { SearchData, RandomizationAlgorithm, SummaryItem } from './types';
import { randomizeSearches, downloadCSV, BRIGHT_COLOR_PALETTE, ALGORITHM_DESCRIPTIONS, getCovariateKey, CovariateColorInfo } from './utils';
import { useFileUpload } from './hooks/useFileUpload';
import { useModalDrag } from './hooks/useModalDrag';
import Papa from 'papaparse';
import Plate from './components/Plate';



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
  const [plateAssignments, setPlateAssignments] = useState<Map<number, SearchData[]> | undefined>(undefined);
  const [covariateColors, setCovariateColors] = useState<{ [key: string]: CovariateColorInfo }>({});
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);

  // UI states
  const [draggedSearch, setDraggedSearch] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [compactView, setCompactView] = useState<boolean>(true);
  const [selectedCombination, setSelectedCombination] = useState<string | null>(null);
  const [showPlateDetails, setShowPlateDetails] = useState<boolean>(false);
  const [selectedPlateIndex, setSelectedPlateIndex] = useState<number | null>(null);

  // Modal drag states
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingModal, setIsDraggingModal] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    setPlateAssignments(undefined);
    setCovariateColors({});
    setSummaryData([]);
    setShowSummary(false);
    setSelectedCombination(null);
  };

  const resetCovariateState = () => {
    setIsProcessed(false);
    setRandomizedPlates([]);
    setPlateAssignments(undefined);
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
      const result = randomizeSearches(searches, selectedCovariates, selectedAlgorithm, keepEmptyInLastPlate, plateRows, plateColumns);
      setRandomizedPlates(result.plates);
      setPlateAssignments(result.plateAssignments);

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
      const result = randomizeSearches(searches, selectedCovariates, selectedAlgorithm, keepEmptyInLastPlate, plateRows, plateColumns);
      setRandomizedPlates(result.plates);
      setPlateAssignments(result.plateAssignments);
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

  // Handle showing plate details
  const handleShowPlateDetails = (plateIndex: number) => {
    setSelectedPlateIndex(plateIndex);
    setShowPlateDetails(true);
  };

  const handleClosePlateDetails = () => {
    if (!isDraggingModal) {
      setShowPlateDetails(false);
      setSelectedPlateIndex(null);
      setModalPosition({ x: 0, y: 0 }); // Reset position when closing
    }
  };

  // Modal drag handlers
  const handleModalMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const modalElement = event.currentTarget.closest('[data-modal-content]') as HTMLElement;
    if (modalElement) {
      const rect = modalElement.getBoundingClientRect();
      setIsDraggingModal(true);
      setDragOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });

      // If this is the first drag, set initial position to current position
      if (modalPosition.x === 0 && modalPosition.y === 0) {
        setModalPosition({
          x: rect.left,
          y: rect.top
        });
      }
    }
  };

  const handleModalMouseMove = useCallback((event: MouseEvent) => {
    if (isDraggingModal) {
      const newX = event.clientX - dragOffset.x;
      const newY = event.clientY - dragOffset.y;

      // Constrain to viewport bounds
      const maxX = window.innerWidth - 600; // Assuming max modal width
      const maxY = window.innerHeight - 400; // Assuming max modal height

      setModalPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  }, [isDraggingModal, dragOffset]);

  const handleModalMouseUp = useCallback(() => {
    setIsDraggingModal(false);
  }, []);

  // Add global mouse event listeners for modal dragging
  React.useEffect(() => {
    if (isDraggingModal) {
      document.addEventListener('mousemove', handleModalMouseMove);
      document.addEventListener('mouseup', handleModalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleModalMouseMove);
        document.removeEventListener('mouseup', handleModalMouseUp);
      };
    }
  }, [isDraggingModal, handleModalMouseMove, handleModalMouseUp]);

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
        <FileUploadSection
          selectedFileName={selectedFileName}
          onFileUpload={handleFileUpload}
        />

        {/* Configuration Form */}
        <ConfigurationForm
          availableColumns={availableColumns}
          selectedIdColumn={selectedIdColumn}
          onIdColumnChange={handleIdColumnChange}
          searches={searches}
          selectedCovariates={selectedCovariates}
          onCovariateChange={handleCovariateChange}
          controlLabels={controlLabels}
          onControlLabelsChange={handleControlLabelsChange}
          selectedAlgorithm={selectedAlgorithm}
          onAlgorithmChange={handleAlgorithmChange}
          keepEmptyInLastPlate={keepEmptyInLastPlate}
          onKeepEmptyInLastPlateChange={handleKeepEmptyInLastPlateChange}
          plateRows={plateRows}
          plateColumns={plateColumns}
          onPlateRowsChange={setPlateRows}
          onPlateColumnsChange={setPlateColumns}
          onResetCovariateState={resetCovariateState}
        />



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

              <SummaryPanel
                summaryData={summaryData}
                showSummary={showSummary}
                onToggleSummary={() => setShowSummary(!showSummary)}
                selectedCombination={selectedCombination}
                onSummaryItemClick={handleSummaryItemClick}
              />



              <PlatesGrid
                randomizedPlates={randomizedPlates}
                compactView={compactView}
                covariateColors={covariateColors}
                selectedCovariates={selectedCovariates}
                plateColumns={plateColumns}
                selectedAlgorithm={selectedAlgorithm}
                highlightFunction={isSearchHighlighted}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onShowDetails={handleShowPlateDetails}
              />
            </>
          )}
        </>

        {/* Plate Details Modal */}
        <PlateDetailsModal
          show={showPlateDetails}
          plateIndex={selectedPlateIndex}
          plateAssignments={plateAssignments}
          searches={searches}
          selectedCovariates={selectedCovariates}
          covariateColors={covariateColors}
          selectedCombination={selectedCombination}
          plateRows={plateRows}
          plateColumns={plateColumns}
          modalPosition={modalPosition}
          isDraggingModal={isDraggingModal}
          onClose={handleClosePlateDetails}
          onMouseDown={handleModalMouseDown}
        />
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
  processButton: {
    padding: '12px 24px',
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '25px',
    transition: 'background-color 0.3s ease',
  },
  processButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  viewControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '25px',
    flexWrap: 'wrap' as const,
  },
  controlButton: {
    padding: '8px 16px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#495057',
    transition: 'all 0.2s ease',
  },
  downloadButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.3s ease',
  },
  summaryToggle: {
    padding: '10px 16px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#495057',
    transition: 'all 0.2s ease',
  },
};

export default App;
