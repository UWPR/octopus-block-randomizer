import React, { useState, useCallback, DragEvent } from 'react';
import Papa from 'papaparse';
import Plate from './components/Plate';
import { SearchData } from './types';
import { randomizeSearches, downloadCSV, BRIGHT_COLOR_PALETTE } from './utils';

const App: React.FC = () => {
  const [searches, setSearches] = useState<SearchData[]>([]);
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([]);
  const [covariateColors, setCovariateColors] = useState<{ [key: string]: string }>({});
  const [randomizedPlates, setRandomizedPlates] = useState<(SearchData | undefined)[][][]>([]);
  const [draggedSearch, setDraggedSearch] = useState<string | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedReferenceColumn, setSelectedReferenceColumn] = useState<string>('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);

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
  };

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

  const handleReferenceColumnChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newReferenceColumn = event.target.value;
    setSelectedReferenceColumn(newReferenceColumn);
    
    if (parsedData.length > 0) {
      const processedSearches = processSearchData(parsedData, newReferenceColumn);
      setSearches(processedSearches);
      resetProcessingState();
    }
  };

  const handleCovariateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedCovariates(selectedOptions);
    setIsProcessed(false);
    setRandomizedPlates([]);
    setCovariateColors({});
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

      setCovariateColors(covariateColorsMap);
    }
  }, [selectedCovariates, searches]);

  const handleProcessRandomization = () => {
    if (selectedReferenceColumn && selectedCovariates.length > 0 && searches.length > 0) {
      const plates = randomizeSearches(searches, selectedCovariates);
      setRandomizedPlates(plates);
      generateCovariateColors();
      setIsProcessed(true);
    }
  };

  const handleDownloadCSV = () => {
    if (selectedReferenceColumn) {
      downloadCSV(searches, randomizedPlates, selectedReferenceColumn);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, searchName: string) => {
    setDraggedSearch(searchName);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, plateIndex: number, rowIndex: number, columnIndex: number) => {
    event.preventDefault();
    if (draggedSearch) {
      const updatedRandomizedPlates = [...randomizedPlates];
      const draggedSearchData = searches.find((search) => search.name === draggedSearch);
      const targetSearchData = updatedRandomizedPlates[plateIndex][rowIndex][columnIndex];

      if (draggedSearchData) {
        // Find the current position of the dragged search
        let draggedSearchPlateIndex = -1;
        let draggedSearchRowIndex = -1;
        let draggedSearchColumnIndex = -1;

        updatedRandomizedPlates.forEach((plate, pIndex) => {
          plate.forEach((row, rIndex) => {
            const index = row.findIndex((s) => s?.name === draggedSearch);
            if (index !== -1) {
              draggedSearchPlateIndex = pIndex;
              draggedSearchRowIndex = rIndex;
              draggedSearchColumnIndex = index;
            }
          });
        });

        // Swap the positions of the dragged search and the target search
        if (targetSearchData) {
          updatedRandomizedPlates[draggedSearchPlateIndex][draggedSearchRowIndex][draggedSearchColumnIndex] = targetSearchData;
        } else {
          updatedRandomizedPlates[draggedSearchPlateIndex][draggedSearchRowIndex][draggedSearchColumnIndex] = undefined;
        }

        updatedRandomizedPlates[plateIndex][rowIndex][columnIndex] = draggedSearchData;
        setRandomizedPlates(updatedRandomizedPlates);
      }
    }
  };

  const canProcess = selectedReferenceColumn && selectedCovariates.length > 0 && searches.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.heading}>Block Randomization</h1>
        
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          style={styles.fileInput} 
        />
        
        {availableColumns.length > 0 && (
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
        )}
        
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
          </div>
        )}
        
        {canProcess && !isProcessed && (
          <button onClick={handleProcessRandomization} style={styles.processButton}>
            Generate Randomized Plates
          </button>
        )}
        
        {isProcessed && (
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
    backgroundColor: '#f0f0f0',
    padding: '20px',
    boxSizing: 'border-box' as const,
  },
  content: {
    width: '100%',
    maxWidth: '1600px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    padding: '20px',
    boxSizing: 'border-box' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  heading: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333',
  },
  fileInput: {
    marginBottom: '20px',
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  selectionGroup: {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
  },
  select: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '14px',
    minWidth: '200px',
  },
  multiSelect: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '14px',
    minWidth: '200px',
    minHeight: '120px',
  },
  processButton: {
    marginBottom: '20px',
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
  },
  platesContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    gap: '20px',
    width: '100%',
    marginBottom: '20px',
  },
  plateWrapper: {
    margin: '10px',
  },
  downloadButton: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
  },
};

export default App;