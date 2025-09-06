import React, { DragEvent } from 'react';
import Search from './Search';
import { SearchData } from '../types';

interface PlateProps {
  plateIndex: number;
  rows: (SearchData | undefined)[][];
  covariateColors: { [key: string]: string };
  selectedCovariates: string[];
  onDragStart: (event: DragEvent<HTMLDivElement>, searchName: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, rowIndex: number, columnIndex: number) => void;
  compact?: boolean;
  highlightFunction?: (search: SearchData) => boolean;
}

const Plate: React.FC<PlateProps> = ({ 
  plateIndex, 
  rows, 
  covariateColors, 
  selectedCovariates, 
  onDragStart, 
  onDragOver, 
  onDrop,
  compact = true,
  highlightFunction
}) => {
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragOver(event);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, rowIndex: number, columnIndex: number) => {
    event.preventDefault();
    onDrop(event, rowIndex, columnIndex);
  };

  const columns = Array.from({ length: 12 }, (_, index) => (index + 1).toString().padStart(2, '0'));

  // Get styles based on compact mode
  const getStyles = () => {
    if (compact) {
      return compactStyles;
    }
    return styles;
  };

  const currentStyles = getStyles();

  return (
    <div style={currentStyles.plate}>
      <h2 style={currentStyles.plateHeading}>Plate {plateIndex + 1}</h2>
      <div style={currentStyles.grid}>
        <div style={currentStyles.columnLabels}>
          <div style={currentStyles.emptyCell} />
          {columns.map((column) => (
            <div key={column} style={currentStyles.columnLabel}>
              {compact ? column.slice(-1) : column}
            </div>
          ))}
        </div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} style={currentStyles.row}>
            <div style={currentStyles.rowLabel}>{String.fromCharCode(65 + rowIndex)}</div>
            {columns.map((_, columnIndex) => {
              const search = row[columnIndex];
              const isHighlighted = search && highlightFunction?.(search);
              
              return (
                <div
                  key={columnIndex}
                  style={{
                    ...(search ? currentStyles.searchWell : currentStyles.emptyWell),
                    ...(isHighlighted ? currentStyles.highlightedWell : {})
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, rowIndex, columnIndex)}
                  title={
                    compact && search 
                      ? `${search.name} (${String.fromCharCode(65 + rowIndex)}${columnIndex + 1})${
                          selectedCovariates.length > 0 
                            ? '\n' + selectedCovariates
                                .map(cov => `${cov}: ${search.metadata[cov] || 'N/A'}`)
                                .join(', ') 
                            : ''
                        }` 
                      : undefined
                  }
                >
                  {search ? (
                    compact ? (
                      // Compact view: just colored square
                      <div
                        style={{
                          ...currentStyles.compactSearchIndicator,
                          backgroundColor: selectedCovariates
                            .map(covariate => covariateColors[search.metadata[covariate]])
                            .find(color => color !== undefined) || '#cccccc',
                          ...(isHighlighted ? currentStyles.highlightedIndicator : {})
                        }}
                        draggable={true}
                        onDragStart={(event) => onDragStart(event, search.name)}
                      />
                    ) : (
                      // Full view: Search component
                      <Search
                        name={search.name}
                        metadata={search.metadata}
                        backgroundColor={
                          selectedCovariates
                            .map(covariate => covariateColors[search.metadata[covariate]])
                            .find(color => color !== undefined) || 'defaultColor'
                        }
                        onDragStart={onDragStart}
                        selectedCovariates={selectedCovariates}
                      />
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const cellWidth = 150;
const rowLabelWidth = 30;
const compactCellWidth = 18;
const compactRowLabelWidth = 15;

const styles = {
  plate: {
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  plateHeading: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  columnLabels: {
    display: 'flex',
    gap: '10px',
  },
  columnLabel: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
    width: `${cellWidth}px`,
    padding: '5px',
  },
  row: {
    display: 'flex',
    gap: '10px',
  },
  rowLabel: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
    width: `${rowLabelWidth}px`,
    padding: '5px',
  },
  searchWell: {
    width: `${cellWidth}px`,
    minHeight: '40px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '5px',
    transition: 'all 0.2s ease',
  },
  emptyWell: {
    width: `${cellWidth}px`,
    minHeight: '40px',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '5px',
  },
  emptyCell: {
    width: `${rowLabelWidth}px`,
    padding: '5px',
  },
  compactSearchIndicator: {
    width: '100%',
    height: '100%',
    borderRadius: '2px',
    cursor: 'move',
    border: '1px solid rgba(0,0,0,0.2)',
    transition: 'all 0.2s ease',
  },
  highlightedWell: {
    border: '3px solid #2196f3',
    boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)',
  },
  highlightedIndicator: {
    border: '2px solid #2196f3',
    boxShadow: '0 0 4px rgba(33, 150, 243, 0.7)',
  },
};

const compactStyles = {
  plate: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '8px',
    backgroundColor: '#f5f5f5',
    fontSize: '10px',
  },
  plateHeading: {
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '4px',
    textAlign: 'center' as const,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  columnLabels: {
    display: 'flex',
    gap: '2px',
  },
  columnLabel: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
    width: `${compactCellWidth}px`,
    padding: '1px',
    fontSize: '8px',
  },
  row: {
    display: 'flex',
    gap: '2px',
  },
  rowLabel: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
    width: `${compactRowLabelWidth}px`,
    padding: '1px',
    fontSize: '8px',
  },
  searchWell: {
    width: `${compactCellWidth}px`,
    height: '16px',
    border: '1px solid #ddd',
    borderRadius: '2px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  emptyWell: {
    width: `${compactCellWidth}px`,
    height: '16px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '2px',
    padding: '1px',
  },
  emptyCell: {
    width: `${compactRowLabelWidth}px`,
    padding: '1px',
  },
  compactSearchIndicator: {
    width: '100%',
    height: '100%',
    borderRadius: '2px',
    cursor: 'move',
    border: '1px solid rgba(0,0,0,0.2)',
    transition: 'all 0.2s ease',
  },
  highlightedWell: {
    border: '3px solid #2196f3',
	boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)',
  },
  highlightedIndicator: {
    border: '2px solid #ffffff',
    boxShadow: '0 0 4px rgba(33, 150, 243, 0.7)',
  },
};

export default Plate;