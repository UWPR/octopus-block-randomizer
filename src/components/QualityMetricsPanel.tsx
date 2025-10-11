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

              {/* Summary Metrics Grid */}
              <div style={styles.metricsGrid}>
                {/* Covariate Group Balance Summary */}
                <div style={styles.metricSection}>
                  <h4 style={styles.sectionTitle}>Covariate Group Balance</h4>
                  <div style={styles.summaryMetrics}>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Average CV</span>
                      <span style={styles.metricValue}>
                        {formatScore(Object.values(metrics.covariateGroups).reduce((sum, g) => sum + g.cv, 0) / Object.values(metrics.covariateGroups).length)}%
                      </span>
                    </div>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Average p-value</span>
                      <span style={styles.metricValue}>
                        {(Object.values(metrics.covariateGroups).reduce((sum, g) => sum + g.pValue, 0) / Object.values(metrics.covariateGroups).length).toFixed(3)}
                      </span>
                    </div>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Overall Balance Score</span>
                      <span style={styles.metricValue}>
                        {formatScore((() => {
                          const groups = Object.values(metrics.covariateGroups);
                          const goodGroups = groups.filter(g => g.adjustedAssessment === 'good').length;
                          const acceptableGroups = groups.filter(g => g.adjustedAssessment === 'acceptable').length;
                          const totalGroups = groups.length;
                          return totalGroups > 0 ? ((goodGroups * 100) + (acceptableGroups * 75)) / totalGroups : 0;
                        })())}
                      </span>
                    </div>
                    <div style={styles.groupBreakdown}>
                      <span style={styles.breakdownText}>
                        {Object.values(metrics.covariateGroups).filter(g => g.adjustedAssessment === 'good').length} good, {' '}
                        {Object.values(metrics.covariateGroups).filter(g => g.adjustedAssessment === 'acceptable').length} acceptable, {' '}
                        {Object.values(metrics.covariateGroups).filter(g => g.adjustedAssessment === 'poor').length} poor
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plate Diversity Summary */}
                <div style={styles.metricSection}>
                  <h4 style={styles.sectionTitle}>Plate Diversity</h4>
                  <div style={styles.summaryMetrics}>
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
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Overall Diversity Score</span>
                      <span style={styles.metricValue}>
                        {formatScore((metrics.plateDiversity.averageProportionalAccuracy * 0.7) + (metrics.plateDiversity.averageEntropy * 0.3))}
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