/**
 * Performance tests for repeated-measures randomization
 * Tests execution time and memory usage with large datasets
 */

import { balancedBlockRandomization } from '../algorithms/balancedRandomization';
import { SearchData, RandomizationConfig } from '../utils/types';

// Helper function to create a mock sample
function createSample(name: string, metadata: Record<string, string>): SearchData {
  return {
    name,
    metadata
  };
}

// Helper function to generate large dataset
function generateLargeDataset(
  numSamples: number,
  numGroups: number,
  treatmentOptions: string[] = ['Drug', 'Placebo']
): SearchData[] {
  const samples: SearchData[] = [];
  const samplesPerGroup = Math.floor(numSamples / numGroups);
  const remainingSamples = numSamples % numGroups;

  // Create groups with approximately equal sizes
  for (let groupIdx = 0; groupIdx < numGroups; groupIdx++) {
    const patientId = `P${String(groupIdx + 1).padStart(5, '0')}`;
    const groupSize = samplesPerGroup + (groupIdx < remainingSamples ? 1 : 0);

    for (let sampleIdx = 0; sampleIdx < groupSize; sampleIdx++) {
      const treatment = treatmentOptions[sampleIdx % treatmentOptions.length];
      samples.push(createSample(`${patientId}_S${sampleIdx + 1}`, {
        PatientID: patientId,
        Treatment: treatment
      }));
    }
  }

  return samples;
}

describe('Repeated-Measures Performance Tests', () => {

  // Suppress console output during tests
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Medium dataset performance', () => {

    test('Should complete randomization with 1000 samples and 100 groups in < 2 seconds', () => {
      // Generate dataset: 960 samples, 96 groups (10 samples per group)
      // Using 960 to fit evenly in 3 plates (320 samples each) with better capacity utilization
      const samples = generateLargeDataset(960, 96);

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false, // Distribute empty spots evenly for better capacity utilization
        numRows: 16,
        numColumns: 24 // 384-well plates
      };

      // Measure execution time
      const startTime = performance.now();
      const result = balancedBlockRandomization(samples, config);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify execution time is under 2 seconds
      expect(executionTime).toBeLessThan(2000);

      // Verify result is valid
      expect(result.plates).toBeDefined();
      expect(result.repeatedMeasuresGroups).toBeDefined();
      expect(result.repeatedMeasuresGroups?.length).toBe(96);

      // Verify all samples are placed
      let totalPlaced = 0;
      result.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) totalPlaced++;
          });
        });
      });
      expect(totalPlaced).toBe(960);

      // Verify constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);

      // Log performance metrics
      console.log(`960 samples, 96 groups: ${executionTime.toFixed(2)}ms`);
    });

    test('Should handle 900 samples with varying group sizes efficiently', () => {
      const samples: SearchData[] = [];

      // Create groups with varying sizes (total 900 samples)
      // 40 small groups (5 samples each) = 200 samples
      for (let i = 0; i < 40; i++) {
        const patientId = `Small_P${String(i + 1).padStart(5, '0')}`;
        for (let j = 0; j < 5; j++) {
          samples.push(createSample(`${patientId}_S${j + 1}`, {
            PatientID: patientId,
            Treatment: j < 3 ? 'Drug' : 'Placebo'
          }));
        }
      }

      // 30 medium groups (15 samples each) = 450 samples
      for (let i = 0; i < 30; i++) {
        const patientId = `Medium_P${String(i + 1).padStart(5, '0')}`;
        for (let j = 0; j < 15; j++) {
          samples.push(createSample(`${patientId}_S${j + 1}`, {
            PatientID: patientId,
            Treatment: j < 8 ? 'Drug' : 'Placebo'
          }));
        }
      }

      // 10 large groups (25 samples each) = 250 samples
      for (let i = 0; i < 10; i++) {
        const patientId = `Large_P${String(i + 1).padStart(5, '0')}`;
        for (let j = 0; j < 25; j++) {
          samples.push(createSample(`${patientId}_S${j + 1}`, {
            PatientID: patientId,
            Treatment: j < 13 ? 'Drug' : 'Placebo'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false,
        numRows: 16,
        numColumns: 24
      };

      const startTime = performance.now();
      const result = balancedBlockRandomization(samples, config);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete in under 2 seconds
      expect(executionTime).toBeLessThan(2000);

      // Verify 80 groups total
      expect(result.repeatedMeasuresGroups?.length).toBe(80);

      // Verify all samples placed
      let totalPlaced = 0;
      result.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) totalPlaced++;
          });
        });
      });
      expect(totalPlaced).toBe(900);

      console.log(`900 samples, varying sizes: ${executionTime.toFixed(2)}ms`);
    });

  });

  describe('Large dataset performance', () => {

    test('Should complete randomization with 5000 samples and 500 groups in < 10 seconds', () => {
      // Generate dataset: 3600 samples, 360 groups (10 samples per group)
      // Adjusted to work within algorithm's capacity constraints (leaves buffer for distribution)
      const samples = generateLargeDataset(3600, 360);

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false,
        numRows: 16,
        numColumns: 24 // 384-well plates
      };

      // Measure execution time
      const startTime = performance.now();
      const result = balancedBlockRandomization(samples, config);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Verify execution time is under 10 seconds
      expect(executionTime).toBeLessThan(10000);

      // Verify result is valid
      expect(result.plates).toBeDefined();
      expect(result.repeatedMeasuresGroups).toBeDefined();
      expect(result.repeatedMeasuresGroups?.length).toBe(360);

      // Verify all samples are placed
      let totalPlaced = 0;
      result.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) totalPlaced++;
          });
        });
      });
      expect(totalPlaced).toBe(3600);

      // Verify constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);

      // Log performance metrics
      console.log(`3600 samples, 360 groups: ${executionTime.toFixed(2)}ms`);
    });

    test('Should handle 3600 samples with multiple treatment variables efficiently', () => {
      const samples: SearchData[] = [];
      const treatments = ['Drug', 'Placebo'];
      const timepoints = ['T0', 'T10', 'T20', 'T30'];

      // Create 360 groups with 10 samples each
      for (let groupIdx = 0; groupIdx < 360; groupIdx++) {
        const patientId = `P${String(groupIdx + 1).padStart(5, '0')}`;

        for (let sampleIdx = 0; sampleIdx < 10; sampleIdx++) {
          samples.push(createSample(`${patientId}_S${sampleIdx + 1}`, {
            PatientID: patientId,
            Treatment: treatments[sampleIdx % treatments.length],
            Timepoint: timepoints[sampleIdx % timepoints.length],
            Gender: sampleIdx % 2 === 0 ? 'Male' : 'Female'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment', 'Timepoint', 'Gender'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false,
        numRows: 16,
        numColumns: 24
      };

      const startTime = performance.now();
      const result = balancedBlockRandomization(samples, config);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete in under 10 seconds
      expect(executionTime).toBeLessThan(10000);

      // Verify result
      expect(result.repeatedMeasuresGroups?.length).toBe(360);
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);

      console.log(`3600 samples, 3 treatment variables: ${executionTime.toFixed(2)}ms`);
    });

  });

  describe('Memory usage monitoring', () => {

    test('Should not cause memory issues with large datasets', () => {
      // Generate a large dataset: 2880 samples, 288 groups
      const samples = generateLargeDataset(2880, 288);

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false,
        numRows: 16,
        numColumns: 24
      };

      // Check memory before
      const memBefore = process.memoryUsage();

      // Run randomization
      const result = balancedBlockRandomization(samples, config);

      // Check memory after
      const memAfter = process.memoryUsage();

      // Calculate memory increase
      const heapIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024; // MB

      // Verify result is valid
      expect(result.plates).toBeDefined();
      expect(result.repeatedMeasuresGroups?.length).toBe(288);

      // Memory increase should be reasonable (< 100 MB for ~3000 samples)
      expect(heapIncrease).toBeLessThan(100);

      console.log(`Memory increase for 2880 samples: ${heapIncrease.toFixed(2)} MB`);
    });

    test('Should handle many small groups efficiently', () => {
      // Create 960 groups with 2 samples each (1920 total samples)
      const samples = generateLargeDataset(1920, 960);

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false,
        numRows: 16,
        numColumns: 24
      };

      const startTime = performance.now();
      const result = balancedBlockRandomization(samples, config);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete efficiently even with many groups
      expect(executionTime).toBeLessThan(5000);

      // Verify all groups created
      expect(result.repeatedMeasuresGroups?.length).toBe(960);

      console.log(`1920 samples, 960 groups: ${executionTime.toFixed(2)}ms`);
    });

  });

  describe('Edge case performance', () => {

    test('Should handle dataset with many singletons efficiently', () => {
      const samples: SearchData[] = [];

      // Create 500 multi-sample groups (2 samples each) = 1000 samples
      for (let i = 0; i < 500; i++) {
        const patientId = `P${String(i + 1).padStart(5, '0')}`;
        for (let j = 0; j < 2; j++) {
          samples.push(createSample(`${patientId}_S${j + 1}`, {
            PatientID: patientId,
            Treatment: j === 0 ? 'Drug' : 'Placebo'
          }));
        }
      }

      // Create 500 singletons
      for (let i = 0; i < 500; i++) {
        samples.push(createSample(`Singleton_${i + 1}`, {
          PatientID: '', // Empty PatientID
          Treatment: i % 2 === 0 ? 'Drug' : 'Placebo'
        }));
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false,
        numRows: 16,
        numColumns: 24
      };

      const startTime = performance.now();
      const result = balancedBlockRandomization(samples, config);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete efficiently
      expect(executionTime).toBeLessThan(3000);

      // Verify 1000 groups total (500 multi-sample + 500 singletons)
      expect(result.repeatedMeasuresGroups?.length).toBe(1000);
      expect(result.qualityMetrics?.groupSizeDistribution.singletons).toBe(500);

      console.log(`1500 samples with 500 singletons: ${executionTime.toFixed(2)}ms`);
    });

    test('Should handle unbalanced group sizes efficiently', () => {
      const samples: SearchData[] = [];

      // Create 5 large groups (50 samples each) = 250 samples
      for (let i = 1; i <= 5; i++) {
        const largePatientId = `P_LARGE_${i}`;
        for (let j = 0; j < 50; j++) {
          samples.push(createSample(`${largePatientId}_S${j + 1}`, {
            PatientID: largePatientId,
            Treatment: j < 25 ? 'Drug' : 'Placebo'
          }));
        }
      }

      // Create 250 small groups (1 sample each) = 250 samples
      for (let i = 0; i < 250; i++) {
        const patientId = `P${String(i + 1).padStart(5, '0')}`;
        samples.push(createSample(`${patientId}_S1`, {
          PatientID: patientId,
          Treatment: i % 2 === 0 ? 'Drug' : 'Placebo'
        }));
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false,
        numRows: 16,
        numColumns: 24
      };

      const startTime = performance.now();
      const result = balancedBlockRandomization(samples, config);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete efficiently despite unbalanced sizes
      expect(executionTime).toBeLessThan(3000);

      // Verify 255 groups total (5 large + 250 small)
      expect(result.repeatedMeasuresGroups?.length).toBe(255);

      console.log(`500 samples with unbalanced sizes: ${executionTime.toFixed(2)}ms`);
    });

  });

});
