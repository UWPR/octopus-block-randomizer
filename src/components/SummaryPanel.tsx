import React from 'react';
import { SummaryItem, RepeatedMeasuresGroup, RepeatedMeasuresQualityMetrics } from '../utils/types';

interface SummaryPanelProps {
  summaryData: SummaryItem[];
  showSummary: boolean;
  onToggleSummary: () => void;
  selectedCombination: string | null;
  onSummaryItemClick: (combination: string) => void;
  repeatedMeasuresGroups?: RepeatedMeasuresGroup[];
  repeatedMeasuresQualityMetrics?: RepeatedMeasuresQualityMetrics;
  repeatedMeasuresVariable?: string;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summaryData,
  showSummary,
  onToggleSummary,
  selectedCombination,
  onSummaryItemClick,
  repeatedMeasuresGroups,
  repeatedMeasuresQualityMetrics,
  repeatedMeasuresVariable,
}) => {
  if (summaryData.length === 0 || !showSummary) return null;

  // Calculate repeated-measures statistics
  const hasRepeatedMeasures = repeatedMeasuresGroups && repeatedMeasuresGroups.length > 0;
  let totalGroups = 0;
  let multiSampleGroups = 0;
  let singletonGroups = 0;
  let largestGroup: { subjectId: string; size: number } | null = null;

  if (hasRepeatedMeasures && repeatedMeasuresGroups) {
    totalGroups = repeatedMeasuresGroups.length;
    multiSampleGroups = repeatedMeasuresGroups.filter(g => !g.isSingleton && g.size > 1).length;
    singletonGroups = repeatedMeasuresGroups.filter(g => g.isSingleton || g.size === 1).length;

    // Find largest group
    const largest = repeatedMeasuresGroups.reduce((max, group) =>
      group.size > max.size ? group : max
    , { subjectId: '', size: 0 });

    if (largest.size > 0) {
      largestGroup = { subjectId: largest.subjectId, size: largest.size };
    }
  }

  return (
    <div style={styles.summaryContainer}>
      <div style={styles.summaryPanel}>
        {/* Repeated-measures metrics section */}
        {hasRepeatedMeasures && repeatedMeasuresQualityMetrics && (
          <div style={styles.repeatedMeasuresSection}>
            <div style={styles.sectionTitle}>
              Repeated-measures Groups ({repeatedMeasuresVariable})
            </div>
            <div style={styles.metricsGrid}>
              <div style={styles.metricItem}>
                <span style={styles.metricLabel}>Total groups:</span>
                <span style={styles.metricValue}>{totalGroups}</span>
              </div>
              <div style={styles.metricItem}>
                <span style={styles.metricLabel}>Multi-sample groups:</span>
                <span style={styles.metricValue}>{multiSampleGroups}</span>
              </div>
              <div style={styles.metricItem}>
                <span style={styles.metricLabel}>Singleton groups:</span>
                <span style={styles.metricValue}>{singletonGroups}</span>
              </div>
              {largestGroup && (
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>Largest group:</span>
                  <span style={styles.metricValue}>
                    {largestGroup.subjectId} ({largestGroup.size} samples)
                  </span>
                </div>
              )}
            </div>

            <div style={styles.metricsGrid}>
              <div style={styles.metricItem}>
                <span style={styles.metricLabel}>Treatment balance score:</span>
                <span style={styles.metricValue}>
                  {repeatedMeasuresQualityMetrics.treatmentBalanceScore.toFixed(1)}/100
                </span>
              </div>
              <div style={styles.metricItem}>
                <span style={styles.metricLabel}>Constraints satisfied:</span>
                <span style={{
                  ...styles.metricValue,
                  color: repeatedMeasuresQualityMetrics.repeatedMeasuresConstraintsSatisfied ? '#28a745' : '#dc3545'
                }}>
                  {repeatedMeasuresQualityMetrics.repeatedMeasuresConstraintsSatisfied ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            </div>

            {/* Detailed group assignments table */}
            {repeatedMeasuresGroups && repeatedMeasuresGroups.length > 0 && (
              <div style={styles.groupsTable}>
                <div style={styles.tableTitle}>Group Assignments:</div>
                <div style={styles.tableHeader}>
                  <div style={styles.tableHeaderCell}>Group ID</div>
                  <div style={styles.tableHeaderCell}>Samples</div>
                  <div style={styles.tableHeaderCell}>Plate</div>
                </div>
                <div style={styles.tableBody}>
                  {repeatedMeasuresGroups
                    .filter(g => !g.isSingleton) // Only show multi-sample groups
                    .sort((a, b) => {
                      // Sort by plate first, then by group ID
                      const plateA = a.assignedPlate ?? 999;
                      const plateB = b.assignedPlate ?? 999;
                      if (plateA !== plateB) return plateA - plateB;
                      return a.subjectId.localeCompare(b.subjectId);
                    })
                    .map((group, idx) => (
                      <div key={idx} style={styles.tableRow}>
                        <div style={styles.tableCell}>{group.subjectId}</div>
                        <div style={styles.tableCellCenter}>{group.size}</div>
                        <div style={styles.tableCellCenter}>
                          {group.assignedPlate !== undefined ? group.assignedPlate + 1 : '-'}
                        </div>
                      </div>
                    ))}
                </div>
                {singletonGroups > 0 && (
                  <div style={styles.tableFooter}>
                    Note: {singletonGroups} singleton sample{singletonGroups !== 1 ? 's' : ''} (blank/n/a IDs) distributed independently
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Treatment combination summary */}
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
  repeatedMeasuresSection: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '12px',
    border: '1px solid #e9ecef',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
    borderBottom: '1px solid #e9ecef',
    paddingBottom: '4px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '8px',
    marginBottom: '8px',
  },
  metricItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    padding: '4px 0',
  },
  metricLabel: {
    color: '#666',
    fontWeight: '500',
  },
  metricValue: {
    color: '#333',
    fontWeight: '600',
  },
  plateGroupCounts: {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #e9ecef',
  },
  plateCountsList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    marginTop: '4px',
  },
  plateCountItem: {
    fontSize: '11px',
    color: '#555',
    backgroundColor: '#f8f9fa',
    padding: '2px 8px',
    borderRadius: '3px',
    border: '1px solid #e9ecef',
  },
  groupsTable: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e9ecef',
  },
  tableTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '8px',
    padding: '8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px 4px 0 0',
    border: '1px solid #dee2e6',
    borderBottom: 'none',
  },
  tableHeaderCell: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#495057',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tableBody: {
    maxHeight: '200px',
    overflowY: 'auto' as const,
    border: '1px solid #dee2e6',
    borderRadius: '0 0 4px 4px',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '8px',
    padding: '6px 8px',
    borderBottom: '1px solid #f1f3f5',
    backgroundColor: '#fff',
  },
  tableCell: {
    fontSize: '12px',
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  tableCellCenter: {
    fontSize: '12px',
    color: '#333',
    textAlign: 'center' as const,
  },
  tableFooter: {
    fontSize: '11px',
    color: '#6c757d',
    fontStyle: 'italic' as const,
    marginTop: '6px',
    padding: '4px 8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
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