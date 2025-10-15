import React from 'react';
import { getQualityLevelColor } from '../utils';

const QualityLegend: React.FC = () => {
  const qualityLevels = [
    { range: '90-100', level: 'excellent', badge: 'E', description: 'Excellent' },
    { range: '80-89', level: 'good', badge: 'G', description: 'Good' },
    { range: '70-79', level: 'fair', badge: 'F', description: 'Fair' },
    { range: '60-69', level: 'poor', badge: 'P', description: 'Poor' },
    { range: '0-59', level: 'bad', badge: 'B', description: 'Bad' },
  ];

  return (
    <div style={styles.legend}>
      <div style={styles.legendTitle}>Quality Scores:</div>
      <div style={styles.legendItems}>
        {qualityLevels.map((item) => (
          <div key={item.level} style={styles.legendItem}>
            <span style={{
              ...styles.badge,
              backgroundColor: getQualityLevelColor(item.level as any)
            }}>
              {item.badge}
            </span>
            <span style={styles.range}>{item.range}</span>
            <span style={styles.description}>({item.description})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  legend: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    padding: '10px 20px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '12px',
  },
  legendTitle: {
    fontWeight: '600',
    color: '#495057',
    marginRight: '10px',
  },
  legendItems: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  badge: {
    padding: '1px 3px',
    borderRadius: '2px',
    color: '#fff',
    fontSize: '9px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    display: 'inline-block',
    minWidth: '12px',
    textAlign: 'center' as const,
  },
  range: {
    fontWeight: '500',
    color: '#495057',
  },
  description: {
    color: '#6c757d',
    fontStyle: 'italic',
  },
};

export default QualityLegend;