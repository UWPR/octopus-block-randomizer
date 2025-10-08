/**
 * PlatesGrid Component
 *
 * Responsibility: Renders a grid layout containing multiple plates
 *
 * This component:
 * - Takes an array of all randomized plates and renders them in a responsive grid
 * - Manages layout styling for compact vs full view modes
 * - Coordinates drag & drop interactions between different plates
 * - Handles spacing, wrapping, and responsive behavior for multiple plates
 * - Acts as a container/coordinator for multiple individual Plate components
 *
 */

import React, { DragEvent } from 'react';
import Plate from './Plate';
import { SearchData } from '../types';
import { CovariateColorInfo } from '../utils';

interface PlatesGridProps {
  randomizedPlates: (SearchData | undefined)[][][];
  compactView: boolean;
  covariateColors: { [key: string]: CovariateColorInfo };
  selectedCovariates: string[];
  plateColumns: number;
  selectedAlgorithm: string;
  highlightFunction?: (search: SearchData) => boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>, searchName: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, plateIndex: number, rowIndex: number, columnIndex: number) => void;
  onShowDetails?: (plateIndex: number) => void;
}

const PlatesGrid: React.FC<PlatesGridProps> = ({
  randomizedPlates,
  compactView,
  covariateColors,
  selectedCovariates,
  plateColumns,
  selectedAlgorithm,
  highlightFunction,
  onDragStart,
  onDragOver,
  onDrop,
  onShowDetails,
}) => {
  if (randomizedPlates.length === 0) return null;

  return (
    <div style={compactView ? styles.compactPlatesContainer : styles.platesContainer}>
      {randomizedPlates.map((plate, plateIndex) => (
        <div key={plateIndex} style={compactView ? styles.compactPlateWrapper : styles.plateWrapper}>
          <Plate
            plateIndex={plateIndex}
            rows={plate}
            covariateColors={covariateColors}
            selectedCovariates={selectedCovariates}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={(event, rowIndex, columnIndex) => onDrop(event, plateIndex, rowIndex, columnIndex)}
            compact={compactView}
            highlightFunction={highlightFunction}
            numColumns={plateColumns}
            onShowDetails={selectedAlgorithm === 'balanced' ? onShowDetails : undefined}
          />
        </div>
      ))}
    </div>
  );
};

const styles = {
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
};

export default PlatesGrid;