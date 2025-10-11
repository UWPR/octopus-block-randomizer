import React from 'react';
import { SearchData, CovariateColorInfo, PlateQualityScore } from '../types';
import { getCovariateKey } from '../utils';

interface PlateDetailsModalProps {
  show: boolean;
  plateIndex: number | null;
  plateAssignments?: Map<number, SearchData[]>;
  searches: SearchData[];
  selectedCovariates: string[];
  covariateColors: { [key: string]: CovariateColorInfo };
  selectedCombination: string | null;
  plateRows: number;
  plateColumns: number;
  modalPosition: { x: number; y: number };
  isDraggingModal: boolean;
  onClose: () => void;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  plateQuality?: PlateQualityScore;
}

const PlateDetailsModal: React.FC<PlateDetailsModalProps> = ({
  show,
  plateIndex,
  plateAssignments,
  searches,
  selectedCovariates,
  covariateColors,
  selectedCombination,
  plateRows,
  plateColumns,
  modalPosition,
  isDraggingModal,
  onClose,
  onMouseDown,
  plateQuality,
}) => {
  const getQualityColor = (score: number): string => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  const formatScore = (score: number): string => score.toFixed(1);
  if (!show || plateIndex === null) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!isDraggingModal && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={handleOverlayClick}>
      <div
        data-modal-content
        style={{
          ...styles.modalContent,
          ...(modalPosition.x !== 0 || modalPosition.y !== 0 ? {
            position: 'absolute' as const,
            left: `${modalPosition.x}px`,
            top: `${modalPosition.y}px`,
            transform: 'none'
          } : {}),
          cursor: isDraggingModal ? 'grabbing' : 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            ...styles.modalHeader,
            cursor: 'grab'
          }}
          onMouseDown={onMouseDown}
        >
          <h3 style={styles.modalTitle}>Plate {plateIndex + 1} Details</h3>
          <button
            onClick={onClose}
            style={styles.modalCloseButton}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ×
          </button>
        </div>
        <div style={styles.modalBody}>
          {plateAssignments && plateAssignments.has(plateIndex) && (
            <>
              <div style={styles.modalSummary}>
                <span><strong>Capacity:</strong> {plateRows * plateColumns}</span>
                <span><strong>Samples:</strong> {plateAssignments.get(plateIndex)!.length}</span>
                {plateQuality && (
                  <>
                    <span>
                      <strong>Balance:</strong>{' '}
                      <span style={{ color: getQualityColor(plateQuality.balanceScore) }}>
                        {formatScore(plateQuality.balanceScore)}
                      </span>
                    </span>
                    <span>
                      <strong>Randomization:</strong>{' '}
                      <span style={{ color: getQualityColor(plateQuality.randomizationScore) }}>
                        {formatScore(plateQuality.randomizationScore)}
                      </span>
                    </span>
                  </>
                )}
              </div>
              {(() => {
                const plateSamples = plateAssignments.get(plateIndex)!;
                const covariateDistribution = new Map<string, number>();

                // Calculate distribution for this plate
                plateSamples.forEach(sample => {
                  const key = getCovariateKey(sample, selectedCovariates);
                  covariateDistribution.set(key, (covariateDistribution.get(key) || 0) + 1);
                });

                // Calculate global distribution for percentage calculation
                const globalDistribution = new Map<string, number>();
                searches.forEach(sample => {
                  const key = getCovariateKey(sample, selectedCovariates);
                  globalDistribution.set(key, (globalDistribution.get(key) || 0) + 1);
                });

                return (
                  <div style={styles.covariateDistribution}>
                    {Array.from(globalDistribution.entries())
                      .sort((a, b) => {
                        // Sort by count on plate (descending), then by global count (descending)
                        const countA = covariateDistribution.get(a[0]) || 0;
                        const countB = covariateDistribution.get(b[0]) || 0;
                        if (countB !== countA) return countB - countA;
                        return b[1] - a[1];
                      })
                      .map(([combination, globalCount]) => {
                        const count = covariateDistribution.get(combination) || 0;
                        const colorInfo = covariateColors[combination] || { color: '#cccccc', useOutline: false, useStripes: false };
                        const percentage = globalCount > 0 ? ((count / globalCount) * 100).toFixed(1) : '0.0';

                        return (
                          <div key={combination} style={{
                            ...styles.distributionItem,
                            ...(count === 0 ? styles.distributionItemEmpty : {}),
                            ...(selectedCombination === combination ? styles.distributionItemSelected : {})
                          }}>
                            <div
                              style={{
                                ...styles.distributionColorIndicator,
                                backgroundColor: colorInfo.useOutline ? 'transparent' : colorInfo.color,
                                ...(colorInfo.useStripes && {
                                  background: `repeating-linear-gradient(45deg, ${colorInfo.color}, ${colorInfo.color} 2px, transparent 2px, transparent 4px)`
                                }),
                                border: colorInfo.useOutline ? `2px solid ${colorInfo.color}` : '1px solid rgba(0,0,0,0.2)',
                                ...(count === 0 ? { opacity: 0.4 } : {})
                              }}
                            />
                            <div style={styles.distributionText}>
                              <div style={{
                                ...styles.distributionCombination,
                                ...(count === 0 ? { color: '#999' } : {})
                              }}>
                                {selectedCovariates.map((cov, idx) => {
                                  const values = combination.split('|');
                                  return (
                                    <span key={cov}>
                                      <strong>{cov}:</strong> {values[idx] || 'N/A'}
                                      {idx < selectedCovariates.length - 1 && ' • '}
                                    </span>
                                  );
                                })}
                              </div>
                              <div style={styles.distributionStats}>
                                <span style={{
                                  ...styles.distributionCount,
                                  ...(count === 0 ? { color: '#999' } : {})
                                }}>
                                  {count}/{globalCount}
                                </span>
                                <span style={{
                                  ...styles.distributionPercentage,
                                  ...(count === 0 ? { color: '#999' } : {})
                                }}>
                                  ({percentage}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })()}
            </>
          )}
          {(!plateAssignments || !plateAssignments.has(plateIndex)) && (
            <div style={styles.noDataMessage}>No covariate distribution data available for this plate.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    maxWidth: '600px',
    maxHeight: '80vh',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
    flexShrink: 0,
    userSelect: 'none' as const,
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#666',
    padding: '2px',
    width: '24px',
    height: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '3px',
    transition: 'background-color 0.2s ease',
  },
  modalBody: {
    padding: '16px 20px',
    fontSize: '13px',
    lineHeight: '1.4',
    overflow: 'auto',
    flex: 1,
  },
  modalSummary: {
    display: 'flex',
    gap: '20px',
    marginBottom: '16px',
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    fontSize: '12px',
  },
  covariateDistribution: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  distributionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '3px',
    border: '1px solid #e9ecef',
  },
  distributionItemEmpty: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
  },
  distributionItemSelected: {
    backgroundColor: '#e3f2fd',
    border: '2px solid #2196f3',
    boxShadow: '0 0 4px rgba(33, 150, 243, 0.3)',
  },
  distributionColorIndicator: {
    width: '16px',
    height: '16px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  distributionText: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  distributionCombination: {
    fontSize: '12px',
    color: '#333',
    flex: 1,
  },
  distributionStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  distributionCount: {
    fontSize: '12px',
    color: '#333',
    fontWeight: '600',
  },
  distributionPercentage: {
    fontSize: '11px',
    color: '#666',
  },
  noDataMessage: {
    textAlign: 'center' as const,
    color: '#666',
    fontStyle: 'italic',
    padding: '20px',
  },
};

export default PlateDetailsModal;