import React from 'react';
import { SummaryItem } from '../types';

interface SummaryPanelProps {
  summaryData: SummaryItem[];
  showSummary: boolean;
  onToggleSummary: () => void;
  selectedCombination: string | null;
  onSummaryItemClick: (combination: string) => void;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summaryData,
  showSummary,
  onToggleSummary,
  selectedCombination,
  onSummaryItemClick,
}) => {
  if (summaryData.length === 0 || !showSummary) return null;

  return (
    <div style={styles.summaryContainer}>
      <div style={styles.summaryPanel}>
        <div style={styles.summaryGrid}>
          {summaryData.map((item, index) => (
            <div
              key={index}
              style={{
                ...styles.summaryItem,
                ...(selectedCombination === item.combination ? styles.summaryItemSelected : {}),
                cursor: 'pointer'
              }}
              onClick={() => onSummaryItemClick(item.combination)}
            >
              <div style={styles.summaryHeader}>
                <div
                  style={{
                    ...styles.colorIndicator,
                    backgroundColor: item.useOutline ? 'transparent' : item.color,
                    ...(item.useStripes && {
                      background: `repeating-linear-gradient(45deg, ${item.color}, ${item.color} 2px, transparent 2px, transparent 4px)`
                    }),
                    border: item.useOutline ? `4px solid ${item.color}` : styles.colorIndicator.border,
                    boxSizing: 'border-box' as const
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
    </div>
  );
};

const styles = {
  summaryContainer: {
    width: '90%',
    marginBottom: '20px',
  },
  summaryPanel: {
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #dee2e6',
  },
  summaryGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
  },
  summaryItem: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    padding: '8px',
    border: '1px solid #e9ecef',
    transition: 'all 0.2s ease',
    flex: '0 0 auto',
    width: '140px',
    minWidth: '140px',
  },
  summaryItemSelected: {
    backgroundColor: '#e3f2fd',
    border: '2px solid #2196f3',
    boxShadow: '0 1px 4px rgba(33, 150, 243, 0.2)',
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  colorIndicator: {
    width: '14px',
    height: '14px',
    borderRadius: '2px',
    border: '1px solid rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  summaryCount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
  summaryDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  covariateDetail: {
    fontSize: '11px',
    color: '#555',
    lineHeight: '1.2',
  },
};

export default SummaryPanel;