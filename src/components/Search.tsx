import React, { DragEvent } from 'react';
import { CovariateColorInfo } from '../utils';

interface SearchProps {
  name: string;
  metadata: { [key: string]: string };
  colorInfo?: CovariateColorInfo;
  onDragStart: (event: DragEvent<HTMLDivElement>, searchName: string) => void;
  selectedCovariates: string[];
  isHighlighted?: boolean;
}

const Search: React.FC<SearchProps> = ({ name, metadata, colorInfo, onDragStart, selectedCovariates, isHighlighted }) => {
  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    onDragStart(event, name);
  };

  const baseCardStyle: React.CSSProperties = colorInfo ? {
    ...styles.card,
    backgroundColor: colorInfo.useOutline ? 'transparent' : colorInfo.color,
    ...(colorInfo.useStripes && { background: `repeating-linear-gradient(45deg, ${colorInfo.color}, ${colorInfo.color} 3px, transparent 3px, transparent 6px)` }),
    border: colorInfo.useOutline ? `5px solid ${colorInfo.color}` : styles.card.border,
    boxSizing: 'border-box'
  } : styles.card;

  const highlightStyle: React.CSSProperties = isHighlighted ? {
    outline: '2px solid #2196f3',
    outlineOffset: '1px',
    boxShadow: '0 0 4px rgba(33, 150, 243, 0.7)'
  } : {};

  const cardStyle = {
    ...baseCardStyle,
    ...highlightStyle
  };

  return (
    <div style={cardStyle} draggable onDragStart={handleDragStart}>
      <h3 style={styles.title}>{name}</h3>
      <hr style={styles.divider} />
      {selectedCovariates.map((covariate: string) => 
        metadata[covariate] ? <div key={covariate} style={styles.metadata}>{`${covariate}: ${metadata[covariate]}`}</div> : null
      )}
    </div>
  );
};

const styles = {
  card: {
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    padding: '16px',
    width: '150px',
    boxSizing: 'border-box' as const,
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#333',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #eee',
    margin: '12px 0',
  },
  metadata: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '0',
  },
};

export default Search;