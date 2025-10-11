import React, { useState, useEffect } from 'react';
import FileUploadSection from './components/FileUploadSection';
import ConfigurationForm from './components/ConfigurationForm';
import SummaryPanel from './components/SummaryPanel';
import PlateDetailsModal from './components/PlateDetailsModal';
import PlatesGrid from './components/PlatesGrid';
import QualityMetricsPanel from './components/QualityMetricsPanel';
import { SearchData, RandomizationAlgorithm } from './types';
import { downloadCSV, getCovariateKey } from './utils';
import { useFileUpload } from './hooks/useFileUpload';
import { useModalDrag } from './hooks/useModalDrag';
import { useRandomization } from './hooks/useRandomization';
import { useCovariateColors } from './hooks/useCovariateColors';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useQualityMetrics } from './hooks/useQualityMetrics';



const App: React.FC = () => {
  // File upload hook
  const {
    searches,
    availableColumns,
    selectedIdColumn,
    selectedFileName,
    handleFileUpload,
    handleIdColumnChange,
  } = useFileUpload();

  // Modal drag hook
  const {
    modalPosition,
    isDraggingModal,
    handleModalMouseDown,
    handleModalMouseMove,
    handleModalMouseUp,
    resetModalPosition,
  } = useModalDrag();

  // Randomization hook
  const {
    isProcessed,
    randomizedPlates,
    plateAssignments,
    processRandomization,
    reRandomize,
    resetRandomization,
    updatePlates,
  } = useRandomization();

  // Covariate colors hook
  const {
    covariateColors,
    summaryData,
    generateCovariateColors,
    generateSummaryData,
    resetColors,
  } = useCovariateColors();

  // Drag and drop hook
  const {
    draggedSearch,
    handleDragStart,
    handleDragOver,
    handleDrop,
  } = useDragAndDrop(randomizedPlates, updatePlates);

  // Quality metrics hook
  const {
    metrics,
    isCalculating,
    showMetrics,
    calculateMetrics,
    resetMetrics,
    toggleMetrics,
    qualitySummary
  } = useQualityMetrics();



  // Configuration states
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([]);
  const [controlLabels, setControlLabels] = useState<string>('');

  // Algorithm selection
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<RandomizationAlgorithm>('balanced');
  const [keepEmptyInLastPlate, setKeepEmptyInLastPlate] = useState<boolean>(true);

  // Plate dimensions
  const [plateRows, setPlateRows] = useState<number>(8);
  const [plateColumns, setPlateColumns] = useState<number>(12);

  // UI states
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [compactView, setCompactView] = useState<boolean>(true);
  const [selectedCombination, setSelectedCombination] = useState<string | null>(null);
  const [showPlateDetails, setShowPlateDetails] = useState<boolean>(false);
  const [selectedPlateIndex, setSelectedPlateIndex] = useState<number | null>(null);


  // Calculate quality metrics when randomization completes
  useEffect(() => {
    if (isProcessed && randomizedPlates.length > 0 && plateAssignments && selectedCovariates.length > 0) {
      calculateMetrics(
        searches,
        randomizedPlates,
        plateAssignments,
        selectedCovariates
      );
    }
  }, [isProcessed, randomizedPlates, plateAssignments, selectedCovariates, searches, calculateMetrics]);

  // Reset all state when a new file is uploaded (but not on initial load)
  useEffect(() => {
    // Only reset if we have a filename and searches data (indicating a successful file upload)
    if (selectedFileName && searches.length > 0) {
      // Reset all application state except the file upload state
      resetRandomization();
      resetColors();
      resetMetrics();
      resetModalPosition();

      // Reset configuration states
      setSelectedCovariates([]);
      setControlLabels('');

      // Reset algorithm selection (keep defaults)
      setSelectedAlgorithm('balanced');
      setKeepEmptyInLastPlate(true);

      // Reset plate dimensions (keep defaults)
      setPlateRows(8);
      setPlateColumns(12);

      // Reset UI states
      setShowSummary(false);
      setCompactView(true);
      setSelectedCombination(null);
      setShowPlateDetails(false);
      setSelectedPlateIndex(null);
    }
  }, [selectedFileName, searches.length]); // Trigger when filename changes or searches are loaded

  const resetCovariateState = () => {
    resetRandomization();
    resetColors();
    resetMetrics();
    setShowSummary(false);
    setSelectedCombination(null);
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



  // Main processing handler
  const handleProcessRandomization = () => {
    if (selectedIdColumn && selectedCovariates.length > 0 && searches.length > 0) {
      // Process randomization
      const success = processRandomization(
        searches,
        selectedCovariates,
        selectedAlgorithm,
        keepEmptyInLastPlate,
        plateRows,
        plateColumns
      );

      if (success) {
        // Generate colors
        const colors = generateCovariateColors(searches, selectedCovariates, controlLabels);

        // Generate summary data
        generateSummaryData(colors, searches, selectedCovariates);
      }
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
      // Re-randomize with existing colors
      reRandomize(
        searches,
        selectedCovariates,
        selectedAlgorithm,
        keepEmptyInLastPlate,
        plateRows,
        plateColumns
      );
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
      resetModalPosition(); // Reset position when closing
    }
  };

  // Add global mouse event listeners for modal dragging
  useEffect(() => {
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
                {metrics && (
                  <button
                    onClick={toggleMetrics}
                    style={styles.qualityButton}
                  >
                    <span style={styles.qualityButtonText}>Quality</span>
                    <div style={styles.qualityButtonIndicators}>
                      <span style={styles.qualityScore}>
                        {metrics.overallQuality.score}
                      </span>
                      <span style={{
                        ...styles.qualityBadge,
                        backgroundColor:
                          metrics.overallQuality.level === 'excellent' ? '#4caf50' :
                          metrics.overallQuality.level === 'good' ? '#ff9800' :
                          metrics.overallQuality.level === 'fair' ? '#f44336' : '#9e9e9e'
                      }}>
                        {metrics.overallQuality.level.charAt(0).toUpperCase() + metrics.overallQuality.level.slice(1)}
                      </span>
                    </div>
                  </button>
                )}

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

                <button
                  onClick={handleReRandomize}
                  style={styles.controlButton}
                  title="Generate new randomization"
                >
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
                qualityMetrics={metrics ?? undefined}
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
          plateQuality={selectedPlateIndex !== null ? metrics?.plateDiversity.plateScores.find(score => score.plateIndex === selectedPlateIndex) : undefined}
        />

        {/* Quality Assessment Modal */}
        <QualityMetricsPanel
          metrics={metrics}
          show={showMetrics}
          onClose={toggleMetrics}
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
  qualityButton: {
    padding: '8px 12px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #bbdefb',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1565c0',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  qualityButtonText: {
    fontSize: '14px',
    fontWeight: '500',
  },
  qualityButtonIndicators: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
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
  qualityIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    fontSize: '12px',
  },
  qualityScore: {
    fontWeight: '600',
    color: '#495057',
  },
  qualityBadge: {
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  },
};

export default App;
