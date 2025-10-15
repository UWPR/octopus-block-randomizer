import React from 'react';
import { getAllQualityLevels } from '../utils';

const QualityLegend: React.FC = () => {
  const qualityLevels = getAllQualityLevels();

  return (
    <div style={styles.legend}>
      <div style={styles.legendTitle}>Quality Scores:</div>
      <div style={styles.legendItems}>
        {qualityLevels.map((item) => (
          <div key={item.level} style={styles.legendItem}>
            <span style={{
              ...styles.badge,
              backgroundColor: item.color
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