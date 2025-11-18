import { useState, useCallback } from 'react';

export function useModalDrag() {
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingModal, setIsDraggingModal] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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

  const resetModalPosition = () => {
    setModalPosition({ x: 0, y: 0 });
  };

  return {
    modalPosition,
    isDraggingModal,
    handleModalMouseDown,
    handleModalMouseMove,
    handleModalMouseUp,
    resetModalPosition,
  };
}