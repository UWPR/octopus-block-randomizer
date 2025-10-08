/**
 * Plate Component
 *
 * Responsibility: Renders a single plate with its wells, samples, and interactions
 *
 * This component:
 * - Displays one individual plate (typically 8 rows × 12 columns = 96 wells)
 * - Renders samples in wells with covariate-based color coding
 * - Handles drag & drop for individual samples within the plate
 * - Shows plate header with plate number and optional details button
 * - Manages compact vs full view display modes for the single plate
 * - Provides tooltips with sample and covariate information
 * - Renders row labels (A-H) and column labels (01-12)
 * - Handles sample highlighting based on covariate selection in summary panel
 *
 */

import React, { DragEvent } from 'react';
import Search from './Search';
import { SearchData } from '../types';
import { getCovariateKey, CovariateColorInfo } from '../utils';

interface PlateProps {
  plateIndex: number;
  rows: (SearchData | undefined)[][];
  covariateColors: { [key: string]: CovariateColorInfo };
  selectedCovariates: string[];
  onDragStart: (event: DragEvent<HTMLDivElement>, searchName: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, rowIndex: number, columnIndex: number) => void;
  compact?: boolean;
  highlightFunction?: (search: SearchData) => boolean;
  numColumns?: number;
  onShowDetails?: (plateIndex: number) => void;
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
  highlightFunction,
  numColumns = 12,
  onShowDetails
}) => {
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragOver(event);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, rowIndex: number, columnIndex: number) => {
    event.preventDefault();
    onDrop(event, rowIndex, columnIndex);
  };

  const columns = Array.from({ length: numColumns }, (_, index) => (index + 1).toString().padStart(2, '0'));

  const currentStyles = compact ? compactStyles : styles;

  return (
    <div style={currentStyles.plate}>
      <div style={currentStyles.plateHeader}>
        <div style={currentStyles.plateHeading}>Plate {plateIndex + 1}</div>
        {onShowDetails && (
          <button
            onClick={() => onShowDetails(plateIndex)}
            style={currentStyles.detailsButton}
            title="Show plate details"
          >
            <div style={currentStyles.detailsIcon}>i</div>
          </button>
        )}
      </div>
      <div style={currentStyles.grid}>
        <div style={currentStyles.columnLabels}>
          <div style={currentStyles.emptyCell} />
          {columns.map((column) => (
            <div key={column} style={currentStyles.columnLabel}>
              {column}
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
                      ? `${search.name} (${String.fromCharCode(65 + rowIndex)}${columnIndex + 1})${selectedCovariates.length > 0
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
                      // Compact view: colored square or outline or stripes
                      (() => {
                        const colorInfo = covariateColors[getCovariateKey(search, selectedCovariates)] || { color: '#cccccc', useOutline: false, useStripes: false };
                        const baseStyle: React.CSSProperties = {
                          ...currentStyles.compactSearchIndicator,
                          backgroundColor: colorInfo.useOutline ? 'transparent' : colorInfo.color,
                          ...(colorInfo.useStripes && { background: `repeating-linear-gradient(45deg, ${colorInfo.color}, ${colorInfo.color} 2px, transparent 2px, transparent 4px)` }),
                          border: colorInfo.useOutline ? `5px solid ${colorInfo.color}` : currentStyles.compactSearchIndicator.border,
                          boxSizing: 'border-box'
                        };

                        const highlightStyle: React.CSSProperties = isHighlighted ? {
                          outline: '2px solid #2196f3',
                          outlineOffset: '1px',
                          boxShadow: '0 0 4px rgba(33, 150, 243, 0.7)'
                        } : {};

                        return (
                          <div
                            style={{
                              ...baseStyle,
                              ...highlightStyle
                            }}
                            draggable={true}
                            onDragStart={(event) => onDragStart(event, search.name)}
                          />
                        );
                      })()
                    ) : (
                      // Full view: Search component
                      <Search
                        name={search.name}
                        metadata={search.metadata}
                        colorInfo={covariateColors[getCovariateKey(search, selectedCovariates)] || { color: '#cccccc', useOutline: false, useStripes: false }}
                        onDragStart={onDragStart}
                        selectedCovariates={selectedCovariates}
                        isHighlighted={isHighlighted}
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

const DIMENSIONS = {
  full: { cellWidth: 100, rowLabelWidth: 25 },
  compact: { cellWidth: 18, rowLabelWidth: 15 }
};

// Base styles shared between full and compact modes
const baseStyles = {
  plateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plateHeading: {
    fontWeight: 'bold',
    margin: 0,
  },
  detailsButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  detailsIcon: {
    borderRadius: '50%',
    backgroundColor: '#999',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  columnLabels: {
    display: 'flex',
  },
  columnLabel: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
  },
  row: {
    display: 'flex',
  },
  rowLabel: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
  },
  compactSearchIndicator: {
    width: '100%',
    height: '100%',
    borderRadius: '2px',
    cursor: 'move',
    border: '1px solid rgba(0,0,0,0.2)',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const,
  },
};

const styles = {
  ...baseStyles,
  plate: {
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    overflowX: 'auto' as const,
    maxWidth: '100%',
  },
  plateHeader: {
    ...baseStyles.plateHeader,
    marginBottom: '10px',
  },
  plateHeading: {
    ...baseStyles.plateHeading,
    fontSize: '20px',
  },
  detailsButton: {
    ...baseStyles.detailsButton,
    padding: '2px',
    borderRadius: '4px',
  },
  detailsIcon: {
    ...baseStyles.detailsIcon,
    width: '18px',
    height: '18px',
    fontSize: '12px',
  },
  grid: {
    ...baseStyles.grid,
    gap: '10px',
  },
  columnLabels: {
    ...baseStyles.columnLabels,
    gap: '10px',
  },
  columnLabel: {
    ...baseStyles.columnLabel,
    width: `${DIMENSIONS.full.cellWidth}px`,
    padding: '5px',
  },
  row: {
    ...baseStyles.row,
    gap: '10px',
  },
  rowLabel: {
    ...baseStyles.rowLabel,
    width: `${DIMENSIONS.full.rowLabelWidth}px`,
    padding: '5px',
  },
  searchWell: {
    width: `${DIMENSIONS.full.cellWidth}px`,
    minHeight: '60px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '5px',
    transition: 'all 0.2s ease',
  },
  emptyWell: {
    width: `${DIMENSIONS.full.cellWidth}px`,
    minHeight: '60px',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '5px',
  },
  emptyCell: {
    width: `${DIMENSIONS.full.rowLabelWidth}px`,
    padding: '5px',
  },
  compactSearchIndicator: baseStyles.compactSearchIndicator,
  highlightedWell: {
    border: '4px solid #2196f3',
    boxShadow: '0 0 12px rgba(33, 150, 243, 0.5), inset 0 0 0 1px rgba(33, 150, 243, 0.3)',
    transform: 'scale(1.02)',
  },
};

const compactStyles = {
  ...baseStyles,
  plate: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '8px',
    backgroundColor: '#f5f5f5',
    fontSize: '10px',
  },
  plateHeader: {
    ...baseStyles.plateHeader,
    marginBottom: '4px',
  },
  plateHeading: {
    ...baseStyles.plateHeading,
    fontSize: '12px',
    textAlign: 'center' as const,
    flex: 1,
  },
  detailsButton: {
    ...baseStyles.detailsButton,
    padding: '1px',
    borderRadius: '2px',
  },
  detailsIcon: {
    ...baseStyles.detailsIcon,
    width: '14px',
    height: '14px',
    fontSize: '10px',
  },
  grid: {
    ...baseStyles.grid,
    gap: '2px',
  },
  columnLabels: {
    ...baseStyles.columnLabels,
    gap: '2px',
  },
  columnLabel: {
    ...baseStyles.columnLabel,
    width: `${DIMENSIONS.compact.cellWidth + 2}px`, // Add 2px for borders
    padding: '1px',
    fontSize: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    ...baseStyles.row,
    gap: '2px',
  },
  rowLabel: {
    ...baseStyles.rowLabel,
    width: `${DIMENSIONS.compact.rowLabelWidth}px`,
    padding: '1px',
    fontSize: '8px',
  },
  searchWell: {
    width: `${DIMENSIONS.compact.cellWidth}px`,
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
    width: `${DIMENSIONS.compact.cellWidth}px`,
    height: '16px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '2px',
    padding: '1px',
  },
  emptyCell: {
    width: `${DIMENSIONS.compact.rowLabelWidth}px`,
    padding: '1px',
  },
  compactSearchIndicator: baseStyles.compactSearchIndicator,
  highlightedWell: {
    border: '4px solid #2196f3',
    boxShadow: '0 0 12px rgba(33, 150, 243, 0.8), inset 0 0 0 1px rgba(33, 150, 243, 0.3)',
    transform: 'scale(1.05)',
  },
};

export default Plate;