import { SearchData } from '../types';
import { calculateQualityMetrics } from './qualityMetrics';

// Simple test to verify simplified quality metrics calculation
const createTestData = (): {
  searches: SearchData[];
  plateAssignments: Map<number, SearchData[]>;
} => {
  const searches: SearchData[] = [
    { name: 'Sample1', metadata: { gender: 'M', age: 'young' } },
    { name: 'Sample2', metadata: { gender: 'F', age: 'young' } },
    { name: 'Sample3', metadata: { gender: 'M', age: 'old' } },
    { name: 'Sample4', metadata: { gender: 'F', age: 'old' } },
  ];

  const plateAssignments = new Map<number, SearchData[]>();
  plateAssignments.set(0, [searches[0], searches[1]]);
  plateAssignments.set(1, [searches[2], searches[3]]);

  return { searches, plateAssignments };
};

// Test function (for manual verification)
export const testSimplifiedQualityMetrics = () => {
  const { searches, plateAssignments } = createTestData();
  const selectedCovariates = ['gender', 'age'];

  try {
    const metrics = calculateQualityMetrics(
      searches,
      plateAssignments,
      selectedCovariates
    );

    console.log('Simplified Quality Metrics Test Results:');
    console.log('Overall Score:', metrics.overallQuality.score);
    console.log('Quality Level:', metrics.overallQuality.level);
    console.log('Recommendations:', metrics.overallQuality.recommendations);
    console.log('Covariate Groups:', metrics.covariateGroups);
    console.log('Plate Diversity:', metrics.plateDiversity);

    return metrics;
  } catch (error) {
    console.error('Simplified quality metrics test failed:', error);
    return null;
  }
};

// Validation function to check inputs
export const validateSimplifiedQualityMetricsInputs = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  selectedCovariates: string[]
) => {
  console.log('Simplified Quality Metrics Input Validation:');
  console.log('- Searches count:', searches.length);
  console.log('- Plates count:', plateAssignments.size);
  console.log('- Selected covariates:', selectedCovariates);

  plateAssignments.forEach((samples, plateIndex) => {
    console.log(`- Plate ${plateIndex}: ${samples.length} samples`);
  });

  selectedCovariates.forEach(covariate => {
    const values = new Set(searches.map(s => s.metadata[covariate] || 'Unknown'));
    console.log(`- Covariate ${covariate}: ${values.size} unique values:`, Array.from(values));
  });
};

// Uncomment to run test
// testSimplifiedQualityMetrics();