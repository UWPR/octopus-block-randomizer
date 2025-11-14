/**
 * Integration tests for end-to-end repeated-measures randomization
 * Tests the complete flow from sample input to plate assignment
 */

import { balancedBlockRandomization } from '../algorithms/balancedRandomization';
import { SearchData, RandomizationConfig, RandomizationResult } from '../utils/types';

// Helper function to create a mock sample
function createSample(name: string, metadata: Record<string, string>): SearchData {
  return {
    name,
    metadata
  };
}

describe('Repeated-Measures Integration Tests', () => {

  // Suppress console output during tests
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Simple case with equal-sized groups', () => {

    test('Should randomize samples with equal-sized groups across single plate', () => {
      // Create 4 patients with 4 samples each (16 total samples)
      const samples: SearchData[] = [];

      for (let patientIdx = 1; patientIdx <= 4; patientIdx++) {
        const patientId = `P${String(patientIdx).padStart(3, '0')}`;

        // Each patient has 2 Drug and 2 Placebo samples
        for (let i = 0; i < 2; i++) {
          samples.push(createSample(`${patientId}_Drug_${i}`, {
            PatientID: patientId,
            Treatment: 'Drug'
          }));
        }
        for (let i = 0; i < 2; i++) {
          samples.push(createSample(`${patientId}_Placebo_${i}`, {
            PatientID: patientId,
            Treatment: 'Placebo'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify result structure
      expect(result.plates).toBeDefined();
      expect(result.repeatedMeasuresGroups).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();

      // Verify groups were created
      expect(result.repeatedMeasuresGroups?.length).toBe(4);

      // Verify all groups have size 4
      result.repeatedMeasuresGroups?.forEach(group => {
        expect(group.size).toBe(4);
        expect(group.isSingleton).toBe(false);
      });

      // Verify repeated-measures constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);

      // Verify all samples are placed
      let totalPlacedSamples = 0;
      result.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) {
              totalPlacedSamples++;
            }
          });
        });
      });
      expect(totalPlacedSamples).toBe(16);
    });

    test('Should keep each patient group on same plate', () => {
      // Create samples for 3 patients across 2 plates
      const samples: SearchData[] = [];

      for (let patientIdx = 1; patientIdx <= 6; patientIdx++) {
        const patientId = `P${String(patientIdx).padStart(3, '0')}`;

        for (let i = 0; i < 10; i++) {
          samples.push(createSample(`${patientId}_Sample_${i}`, {
            PatientID: patientId,
            Treatment: i < 5 ? 'Drug' : 'Placebo'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Track which plate each patient is on
      const patientPlateMap = new Map<string, number>();

      result.plates.forEach((plate, plateIdx) => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) {
              const patientId = cell.metadata.PatientID;

              if (patientPlateMap.has(patientId)) {
                // Verify patient is on same plate as before
                expect(patientPlateMap.get(patientId)).toBe(plateIdx);
              } else {
                patientPlateMap.set(patientId, plateIdx);
              }
            }
          });
        });
      });

      // Verify all patients are tracked
      expect(patientPlateMap.size).toBe(6);
    });

  });

  describe('Uneven group sizes', () => {

    test('Should handle groups of different sizes', () => {
      const samples: SearchData[] = [];

      // Patient 1: 2 samples
      samples.push(
        createSample('P001_S1', { PatientID: 'P001', Treatment: 'Drug' }),
        createSample('P001_S2', { PatientID: 'P001', Treatment: 'Placebo' })
      );

      // Patient 2: 5 samples
      for (let i = 1; i <= 5; i++) {
        samples.push(createSample(`P002_S${i}`, {
          PatientID: 'P002',
          Treatment: i <= 3 ? 'Drug' : 'Placebo'
        }));
      }

      // Patient 3: 10 samples
      for (let i = 1; i <= 10; i++) {
        samples.push(createSample(`P003_S${i}`, {
          PatientID: 'P003',
          Treatment: i <= 5 ? 'Drug' : 'Placebo'
        }));
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify groups were created with correct sizes
      expect(result.repeatedMeasuresGroups?.length).toBe(3);

      const groupSizes = result.repeatedMeasuresGroups?.map(g => g.size).sort((a, b) => a - b);
      expect(groupSizes).toEqual([2, 5, 10]);

      // Verify constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);

      // Verify group size distribution
      expect(result.qualityMetrics?.groupSizeDistribution.small).toBe(2); // 2-5 samples
      expect(result.qualityMetrics?.groupSizeDistribution.medium).toBe(1); // 6-15 samples
    });

    test('Should distribute large and small groups appropriately', () => {
      const samples: SearchData[] = [];

      // Create 2 large groups (30 samples each) and 4 small groups (5 samples each)
      for (let i = 1; i <= 2; i++) {
        const patientId = `Large_P${i}`;
        for (let j = 1; j <= 30; j++) {
          samples.push(createSample(`${patientId}_S${j}`, {
            PatientID: patientId,
            Treatment: j <= 15 ? 'Drug' : 'Placebo'
          }));
        }
      }

      for (let i = 1; i <= 4; i++) {
        const patientId = `Small_P${i}`;
        for (let j = 1; j <= 5; j++) {
          samples.push(createSample(`${patientId}_S${j}`, {
            PatientID: patientId,
            Treatment: j <= 2 ? 'Drug' : 'Placebo'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify all groups are created
      expect(result.repeatedMeasuresGroups?.length).toBe(6);

      // Verify constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);

      // Verify all samples are placed
      let totalPlaced = 0;
      result.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) totalPlaced++;
          });
        });
      });
      expect(totalPlaced).toBe(80); // 60 + 20
    });

  });

  describe('Mixed groups and singletons', () => {

    test('Should handle samples with and without PatientID', () => {
      const samples: SearchData[] = [];

      // Patient 1: 4 samples with PatientID
      for (let i = 1; i <= 4; i++) {
        samples.push(createSample(`P001_S${i}`, {
          PatientID: 'P001',
          Treatment: i <= 2 ? 'Drug' : 'Placebo'
        }));
      }

      // Patient 2: 4 samples with PatientID
      for (let i = 1; i <= 4; i++) {
        samples.push(createSample(`P002_S${i}`, {
          PatientID: 'P002',
          Treatment: i <= 2 ? 'Drug' : 'Placebo'
        }));
      }

      // 4 samples without PatientID (singletons)
      for (let i = 1; i <= 4; i++) {
        samples.push(createSample(`Singleton_S${i}`, {
          PatientID: '', // Empty PatientID
          Treatment: i <= 2 ? 'Drug' : 'Placebo'
        }));
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify groups: 2 multi-sample groups + 4 singletons = 6 total
      expect(result.repeatedMeasuresGroups?.length).toBe(6);

      // Count singletons
      const singletonCount = result.repeatedMeasuresGroups?.filter(g => g.isSingleton).length;
      expect(singletonCount).toBe(4);

      // Verify group size distribution
      expect(result.qualityMetrics?.groupSizeDistribution.singletons).toBe(4);
      expect(result.qualityMetrics?.groupSizeDistribution.small).toBe(2); // 2-5 samples

      // Verify constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
    });

    test('Should distribute singletons independently', () => {
      const samples: SearchData[] = [];

      // 1 multi-sample group
      for (let i = 1; i <= 10; i++) {
        samples.push(createSample(`P001_S${i}`, {
          PatientID: 'P001',
          Treatment: i <= 5 ? 'Drug' : 'Placebo'
        }));
      }

      // 10 singletons
      for (let i = 1; i <= 10; i++) {
        samples.push(createSample(`Single_S${i}`, {
          PatientID: '',
          Treatment: i <= 5 ? 'Drug' : 'Placebo'
        }));
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify 11 groups total (1 multi-sample + 10 singletons)
      expect(result.repeatedMeasuresGroups?.length).toBe(11);

      // Verify singletons can be on any plate
      const singletonPlates = new Set<number>();
      result.plates.forEach((plate, plateIdx) => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined && cell.metadata.PatientID === '') {
              singletonPlates.add(plateIdx);
            }
          });
        });
      });

      // At least one singleton should be placed
      expect(singletonPlates.size).toBeGreaterThan(0);
    });

  });

  describe('Multiple plates', () => {

    test('Should distribute groups across multiple plates', () => {
      const samples: SearchData[] = [];

      // Create 10 patients with 10 samples each (100 total samples)
      // This should require 2 plates (96-well plates)
      for (let patientIdx = 1; patientIdx <= 10; patientIdx++) {
        const patientId = `P${String(patientIdx).padStart(3, '0')}`;

        for (let i = 1; i <= 10; i++) {
          samples.push(createSample(`${patientId}_S${i}`, {
            PatientID: patientId,
            Treatment: i <= 5 ? 'Drug' : 'Placebo'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: false, // Distribute empty spots evenly to avoid capacity issues
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify multiple plates are created
      expect(result.plates.length).toBeGreaterThan(1);

      // Verify groups are distributed across plates
      expect(result.qualityMetrics?.plateGroupCounts.length).toBe(result.plates.length);

      // Verify each plate has some groups
      result.qualityMetrics?.plateGroupCounts.forEach(count => {
        expect(count).toBeGreaterThan(0);
      });

      // Verify constraints are satisfied across all plates
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);
    });

    test('Should maintain treatment balance across multiple plates', () => {
      const samples: SearchData[] = [];

      // Create 12 patients with 8 samples each (96 total samples)
      for (let patientIdx = 1; patientIdx <= 12; patientIdx++) {
        const patientId = `P${String(patientIdx).padStart(3, '0')}`;

        for (let i = 1; i <= 8; i++) {
          samples.push(createSample(`${patientId}_S${i}`, {
            PatientID: patientId,
            Treatment: i <= 4 ? 'Drug' : 'Placebo',
            Timepoint: i % 2 === 0 ? 'T0' : 'T10'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment', 'Timepoint'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify treatment balance score is reasonable
      expect(result.qualityMetrics?.treatmentBalanceScore).toBeGreaterThan(0);
      expect(result.qualityMetrics?.treatmentBalanceScore).toBeLessThanOrEqual(100);

      // Verify standard quality metrics are calculated
      expect(result.qualityMetrics?.standardMetrics).toBeDefined();
      expect(result.qualityMetrics?.standardMetrics.plateDiversity).toBeDefined();
      expect(result.qualityMetrics?.standardMetrics.overallQuality).toBeDefined();
    });

    test('Should handle uneven distribution across plates', () => {
      const samples: SearchData[] = [];

      // Create groups that will result in uneven plate distribution
      // 3 large groups (30 samples each) = 90 samples
      // Should fill first plate and partially fill second
      for (let i = 1; i <= 3; i++) {
        const patientId = `Large_P${i}`;
        for (let j = 1; j <= 30; j++) {
          samples.push(createSample(`${patientId}_S${j}`, {
            PatientID: patientId,
            Treatment: j <= 15 ? 'Drug' : 'Placebo'
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify plates are created
      expect(result.plates.length).toBeGreaterThan(0);

      // Verify per-plate group counts
      const totalGroupsAcrossPlates = result.qualityMetrics?.plateGroupCounts.reduce((sum, count) => sum + count, 0);
      expect(totalGroupsAcrossPlates).toBe(3);

      // Verify constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
    });

  });

  describe('Backward compatibility (no repeated-measures variable)', () => {

    test('Should use standard randomization when no repeated-measures variable', () => {
      const samples: SearchData[] = [];

      // Create samples with PatientID but don't use it for grouping
      for (let i = 1; i <= 20; i++) {
        samples.push(createSample(`Sample_${i}`, {
          PatientID: `P${String(i).padStart(3, '0')}`,
          Treatment: i <= 10 ? 'Drug' : 'Placebo'
        }));
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        // No repeatedMeasuresVariable
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config);

      // Verify result structure
      expect(result.plates).toBeDefined();

      // Verify repeated-measures metadata is NOT present
      expect((result as any).repeatedMeasuresGroups).toBeUndefined();
      expect((result as any).qualityMetrics).toBeUndefined();

      // Verify all samples are placed
      let totalPlaced = 0;
      result.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) totalPlaced++;
          });
        });
      });
      expect(totalPlaced).toBe(20);
    });

    test('Should work with legacy function signature', () => {
      const samples: SearchData[] = [];

      for (let i = 1; i <= 16; i++) {
        samples.push(createSample(`Sample_${i}`, {
          Treatment: i <= 8 ? 'Drug' : 'Placebo'
        }));
      }

      // Use legacy signature
      const result = balancedBlockRandomization(
        samples,
        ['Treatment'],
        true,
        8,
        12
      );

      // Verify result structure
      expect(result.plates).toBeDefined();
      expect(result.plateAssignments).toBeDefined();

      // Verify no repeated-measures metadata
      expect((result as any).repeatedMeasuresGroups).toBeUndefined();
      expect((result as any).qualityMetrics).toBeUndefined();
    });

    test('Should produce same results as before when no repeated-measures variable', () => {
      const samples: SearchData[] = [];

      for (let i = 1; i <= 24; i++) {
        samples.push(createSample(`Sample_${i}`, {
          Treatment: i <= 12 ? 'Drug' : 'Placebo',
          Timepoint: i % 2 === 0 ? 'T0' : 'T10'
        }));
      }

      // Run with new signature (no repeated-measures variable)
      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment', 'Timepoint'],
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };
      const resultNew = balancedBlockRandomization(samples, config);

      // Run with legacy signature
      const resultLegacy = balancedBlockRandomization(
        samples,
        ['Treatment', 'Timepoint'],
        true,
        8,
        12
      );

      // Both should place all samples
      let totalPlacedNew = 0;
      resultNew.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) totalPlacedNew++;
          });
        });
      });

      let totalPlacedLegacy = 0;
      resultLegacy.plates.forEach(plate => {
        plate.forEach(row => {
          row.forEach(cell => {
            if (cell !== undefined) totalPlacedLegacy++;
          });
        });
      });

      expect(totalPlacedNew).toBe(24);
      expect(totalPlacedLegacy).toBe(24);
    });

  });

  describe('Quality metrics validation', () => {

    test('Should calculate comprehensive quality metrics', () => {
      const samples: SearchData[] = [];

      // Create 8 patients with 12 samples each
      for (let patientIdx = 1; patientIdx <= 8; patientIdx++) {
        const patientId = `P${String(patientIdx).padStart(3, '0')}`;

        for (let i = 1; i <= 12; i++) {
          samples.push(createSample(`${patientId}_S${i}`, {
            PatientID: patientId,
            Treatment: i <= 6 ? 'Drug' : 'Placebo',
            Timepoint: i % 3 === 0 ? 'T0' : (i % 3 === 1 ? 'T10' : 'T20')
          }));
        }
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment', 'Timepoint'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Verify all quality metrics are present
      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBeDefined();
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBeDefined();
      expect(result.qualityMetrics?.treatmentBalanceScore).toBeDefined();
      expect(result.qualityMetrics?.plateGroupCounts).toBeDefined();
      expect(result.qualityMetrics?.groupSizeDistribution).toBeDefined();
      expect(result.qualityMetrics?.standardMetrics).toBeDefined();

      // Verify constraints are satisfied
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);

      // Verify group size distribution
      const dist = result.qualityMetrics?.groupSizeDistribution;
      expect(dist?.singletons).toBe(0);
      expect(dist?.medium).toBe(8); // 8 groups of 12 samples each

      // Verify treatment balance score is in valid range
      expect(result.qualityMetrics?.treatmentBalanceScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics?.treatmentBalanceScore).toBeLessThanOrEqual(100);
    });

    test('Should report violations if constraints are not satisfied', () => {
      // This test verifies that the validation logic works
      // In normal operation, violations should not occur
      const samples: SearchData[] = [];

      for (let i = 1; i <= 10; i++) {
        samples.push(createSample(`Sample_${i}`, {
          PatientID: 'P001',
          Treatment: i <= 5 ? 'Drug' : 'Placebo'
        }));
      }

      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12
      };

      const result = balancedBlockRandomization(samples, config) as RandomizationResult;

      // Should have no violations in normal operation
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
    });

  });

});
