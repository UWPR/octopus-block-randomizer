import React from 'react';
import { QualityMetrics } from '../types';

interface QualityMetricsPanelProps {
  metrics: QualityMetrics | null;
  show: boolean;
  onToggle: () => void;
}

const QualityMetricsPanel: React.FC<QualityMetricsPanelProps> = ({
  metrics,
  show,
  onToggle
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

  return (
    <div style={styles.container}>
      <button
        onClick={onToggle}
        style={styles.toggleButton}
      >
        {show ? '▼ Hide' : '▶ Show'} Quality Assessment
        {metrics && (
          <span style={styles.qualityBadge}>
            {getQualityIcon(metrics.overallQuality.level)} {metrics.overallQuality.score}
          </span>
        )}
        {!metrics && (
          <span style={styles.loadingBadge}>
            ⏳ Calculating...
          </span>
        )}
      </button>

      {show && (
        <div style={styles.panel}>
          {!metrics && (
            <div style={styles.loadingMessage}>
              <div style={styles.loadingIcon}>⏳</div>
              <div>Calculating quality metrics...</div>
              <div style={styles.loadingSubtext}>This may take a moment for large datasets</div>
            </div>
          )}

          {metrics && (
            <>
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

              {/* Metrics Grid */}
              <div style={styles.metricsGrid}>
                {/* Covariate Groups */}
                <div style={styles.metricSection}>
                  <h4 style={styles.sectionTitle}>Covariate Group Balance</h4>
                  <div style={styles.covariateList}>
                    {Object.entries(metrics.covariateGroups).map(([combination, metric]) => (
                      <div key={combination} style={styles.covariateItem}>
                        <div style={styles.covariateHeader}>
                          <div style={styles.combinationInfo}>
                            <span style={styles.covariateName}>{combination}</span>
                            <span style={styles.sampleCount}>
                              ({metric.sampleCount} samples{metric.isSmallGroup ? ' - small group' : ''})
                            </span>
                          </div>
                          <span
                            style={{
                              ...styles.assessmentBadge,
                              backgroundColor: getAssessmentColor(metric.adjustedAssessment)
                            }}
                          >
                            {metric.adjustedAssessment}
                          </span>
                        </div>
                        <div style={styles.covariateDetails}>
                          <span>CV: {formatScore(metric.cv)}%</span>
                          <span>p-value: {metric.pValue.toFixed(3)}</span>
                          {metric.isSmallGroup && <span style={styles.smallGroupNote}>*Adjusted criteria</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plate Diversity */}
                <div style={styles.metricSection}>
                  <h4 style={styles.sectionTitle}>Plate Diversity</h4>
                  <div style={styles.plateMetrics}>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Avg Proportional Accuracy</span>
                      <span style={styles.metricValue}>
                        {formatScore(metrics.plateDiversity.averageProportionalAccuracy)}
                      </span>
                    </div>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Avg Entropy (Diversity)</span>
                      <span style={styles.metricValue}>
                        {formatScore(metrics.plateDiversity.averageEntropy)}
                      </span>
                    </div>

                    {/* Individual Plate Scores */}
                    <div style={styles.plateScoresSection}>
                      <div style={styles.plateScoresTitle}>Individual Plates:</div>
                      <div style={styles.plateScoresList}>
                        {metrics.plateDiversity.plateScores.map(score => (
                          <div key={score.plateIndex} style={styles.plateScoreItem}>
                            <span style={styles.plateNumber}>P{score.plateIndex + 1}</span>
                            <span style={styles.plateScore}>
                              Acc: {formatScore(score.proportionalAccuracy)}
                            </span>
                            <span style={styles.plateScore}>
                              Ent: {formatScore(score.entropy)}
                            </span>
                          </div>
                        ))}
                      </div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '90%',
    marginBottom: '20px',
  },
  toggleButton: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#495057',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  qualityBadge: {
    fontSize: '12px',
    fontWeight: '600',
  },
  loadingBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
  },
  panel: {
    backgroundColor: '#fff',
    border: '1px solid #dee2e6',
    borderTop: 'none',
    borderRadius: '0 0 6px 6px',
    padding: '16px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
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
  covariateList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  covariateItem: {
    padding: '8px',
    backgroundColor: '#fff',
    borderRadius: '3px',
    border: '1px solid #e9ecef',
  },
  covariateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  combinationInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  covariateName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#333',
  },
  sampleCount: {
    fontSize: '10px',
    color: '#666',
    fontWeight: '400',
  },
  assessmentBadge: {
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  },
  covariateDetails: {
    display: 'flex',
    gap: '12px',
    fontSize: '10px',
    color: '#666',
  },
  smallGroupNote: {
    fontStyle: 'italic',
    color: '#999',
  },
  plateMetrics: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
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
  plateScoresSection: {
    marginTop: '8px',
  },
  plateScoresTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '4px',
  },
  plateScoresList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  plateScoreItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '4px 6px',
    backgroundColor: '#fff',
    borderRadius: '3px',
    border: '1px solid #e9ecef',
    fontSize: '9px',
  },
  plateNumber: {
    fontWeight: '600',
    color: '#333',
    marginBottom: '2px',
  },
  plateScore: {
    color: '#666',
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