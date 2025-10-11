import React from 'react';
import { QualityMetrics } from '../types';

interface QualityMetricsPanelProps {
  metrics: QualityMetrics | null;
  show: boolean;
  onClose: () => void;
}

const QualityMetricsPanel: React.FC<QualityMetricsPanelProps> = ({
  metrics,
  show,
  onClose
}) => {
  const getQualityColor = (level: string): string => {
    switch (level) {
      case 'excellent': return '#4caf50';
      case 'good': return '#ff9800';
      case 'fair': return '#f44336';
      case 'poor': return '#9e9e9e';
      default: return '#666';
    }
  };

  const getQualityIcon = (level: string): string => {
    switch (level) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'fair': return '🟠';
      case 'poor': return '🔴';
      default: return '⚪';
    }
  };

  const getAssessmentColor = (assessment: string): string => {
    switch (assessment) {
      case 'good': return '#4caf50';
      case 'acceptable': return '#ff9800';
      case 'poor': return '#f44336';
      default: return '#666';
    }
  };

  const formatScore = (score: number): string => score.toFixed(1);

  if (!show) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={handleOverlayClick}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Quality Assessment</h3>
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
          {!metrics && (
            <div style={styles.loadingMessage}>
              <div style={styles.loadingIcon}>⏳</div>
              <div>Calculating quality metrics...</div>
              <div style={styles.loadingSubtext}>This may take a moment for large datasets</div>
            </div>
          )}

          {metrics && (
            <div style={styles.panel}>
              {/* Overall Quality Summary */}
              <div style={styles.summarySection}>
                <div style={styles.overallScore}>
                  <div style={styles.scoreCircle}>
                    <div
                      style={{
                        ...styles.scoreValue,
                        color: getQualityColor(metrics.overallQuality.level)
                      }}
                    >
                      {metrics.overallQuality.score}
                    </div>
                    <div style={styles.scoreLabel}>Overall Quality</div>
                  </div>
                  <div style={styles.qualityLevel}>
                    <span style={styles.qualityIcon}>{getQualityIcon(metrics.overallQuality.level)}</span>
                    <span style={styles.qualityText}>
                      {metrics.overallQuality.level.charAt(0).toUpperCase() + metrics.overallQuality.level.slice(1)} Quality
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Metrics Grid */}
              <div style={styles.metricsGrid}>
                {/* Plate Balance Summary */}
                <div style={styles.metricSection}>
                  <h4 style={styles.sectionTitle}>Plate Balance</h4>
                  <div style={styles.summaryMetrics}>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Average Balance Score</span>
                      <span style={styles.metricValue}>
                        {formatScore(metrics.plateDiversity.averageBalanceScore)}
                      </span>
                    </div>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Best Plate</span>
                      <span style={styles.metricValue}>
                        {formatScore(Math.max(...metrics.plateDiversity.plateScores.map(p => p.balanceScore)))}
                      </span>
                    </div>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Worst Plate</span>
                      <span style={styles.metricValue}>
                        {formatScore(Math.min(...metrics.plateDiversity.plateScores.map(p => p.balanceScore)))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plate Randomization Summary */}
                <div style={styles.metricSection}>
                  <h4 style={styles.sectionTitle}>Plate Randomization</h4>
                  <div style={styles.summaryMetrics}>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Average Randomization Score</span>
                      <span style={styles.metricValue}>
                        {formatScore(metrics.plateDiversity.averageRandomizationScore)}
                      </span>
                    </div>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Best Plate</span>
                      <span style={styles.metricValue}>
                        {formatScore(Math.max(...metrics.plateDiversity.plateScores.map(p => p.randomizationScore)))}
                      </span>
                    </div>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Worst Plate</span>
                      <span style={styles.metricValue}>
                        {formatScore(Math.min(...metrics.plateDiversity.plateScores.map(p => p.randomizationScore)))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {metrics.overallQuality.recommendations.length > 0 && (
                <div style={styles.recommendationsSection}>
                  <h4 style={styles.sectionTitle}>Recommendations</h4>
                  <ul style={styles.recommendationsList}>
                    {metrics.overallQuality.recommendations.map((recommendation, index) => (
                      <li key={index} style={styles.recommendationItem}>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
    flexShrink: 0,
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '4px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease',
  },
  modalBody: {
    padding: '20px',
    overflow: 'auto',
    flex: 1,
  },
  panel: {
    fontWeight: '600',
  },
  loadingMessage: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#666',
  },
  loadingIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  loadingSubtext: {
    fontSize: '12px',
    color: '#999',
    marginTop: '8px',
  },
  summarySection: {
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
  },
  overallScore: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  scoreCircle: {
    textAlign: 'center' as const,
  },
  scoreValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    display: 'block',
  },
  scoreLabel: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
  },
  qualityLevel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  qualityIcon: {
    fontSize: '24px',
  },
  qualityText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  metricSection: {
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
  summaryMetrics: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  metricItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
    backgroundColor: '#fff',
    borderRadius: '3px',
    fontSize: '12px',
  },
  metricLabel: {
    color: '#666',
  },
  metricValue: {
    fontWeight: '600',
    color: '#333',
  },
  groupBreakdown: {
    padding: '4px 8px',
    backgroundColor: '#e3f2fd',
    borderRadius: '3px',
    fontSize: '11px',
  },
  breakdownText: {
    color: '#1565c0',
  },
  recommendationsSection: {
    padding: '12px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    border: '1px solid #bbdefb',
  },
  recommendationsList: {
    margin: '0',
    paddingLeft: '16px',
  },
  recommendationItem: {
    fontSize: '12px',
    color: '#1565c0',
    marginBottom: '4px',
    lineHeight: '1.4',
  },
};

export default QualityMetricsPanel;