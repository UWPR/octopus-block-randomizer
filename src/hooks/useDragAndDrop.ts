import { useState, DragEvent } from 'react';
import { SearchData } from '../utils/types';

/**
 * Custom hook for managing drag and drop functionality for plate randomization
 * Handles dragging searches between plate positions and manages drag state
 */
export const useDragAndDrop = (
  randomizedPlates: (SearchData | undefined)[][][],
  updatePlates: (fromPlate: number, fromRow: number, fromCol: number, toPlate: number, toRow: number, toCol: number) => void
) => {
  const [draggedSearch, setDraggedSearch] = useState<string | null>(null);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, searchName: string) => {
    setDraggedSearch(searchName);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', searchName);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    plateIndex: number,
    rowIndex: number,
    columnIndex: number
  ) => {
    event.preventDefault();

    if (!draggedSearch) return;

    // Find the current position of the dragged search in randomizedPlates
    let draggedPosition = null;
    for (let pIndex = 0; pIndex < randomizedPlates.length; pIndex++) {
      for (let rIndex = 0; rIndex < randomizedPlates[pIndex].length; rIndex++) {
        const cIndex = randomizedPlates[pIndex][rIndex].findIndex(
          (s) => s?.name === draggedSearch
        );
        if (cIndex !== -1) {
          draggedPosition = { plateIndex: pIndex, rowIndex: rIndex, columnIndex: cIndex };
          break;
        }
      }
      if (draggedPosition) break;
    }

    if (!draggedPosition) return;

    // Update the plates through the randomization hook
    updatePlates(
      draggedPosition.plateIndex,
      draggedPosition.rowIndex,
      draggedPosition.columnIndex,
      plateIndex,
      rowIndex,
      columnIndex
    );

    setDraggedSearch(null);
  };

  return {
    draggedSearch,
    handleDragStart,
    handleDragOver,
    handleDrop,
  };
};