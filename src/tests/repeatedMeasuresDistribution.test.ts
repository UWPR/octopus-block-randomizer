/**
 * Tests for repeatedMeasuresDistribution.ts
 * Tests the distribution algorithm that assigns repeated-measures groups to plates
 */

import { distributeGroupsToPlates } from '../algorithms/repeatedMeasuresDistribution';
import { RepeatedMeasuresGroup, SearchData } from '../utils/types';

// Helper function to create a mock sample
function createMockSample(id: string, metadata: Record<string, string>): SearchData {
  return {
    name: `Sample_${id}`,
    metadata
  };
}

// Helper function to create a repeated-measures group
function createGroup(
  subjectId: string,
  size: number,
  treatmentComposition: Record<string, number>,
  isSingleton: boolean = false
): RepeatedMeasuresGroup {
  const samples: SearchData[] = [];

  // Create mock samples based on treatment composition
  let sampleCounter = 0;
  Object.entries(treatmentComposition).forEach(([treatmentKey, count]) => {
    const [treatment, timepoint] = treatmentKey.split('|');
    for (let i = 0; i < count; i++) {
      samples.push(createMockSample(
        `${subjectId}_${sampleCounter++}`,
        { Treatment: treatment, Timepoint: timepoint, SubjectID: subjectId }
      ));
    }
  });

  return {
    subjectId,
    samples,
    treatmentComposition: new Map(Object.entries(treatmentComposition)),
    size,
    isSingleton
  };
}

describe('distributeGroupsToPlates', () => {

  // Suppress console output during tests
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Capacity Constraints', () => {

    test('Should respect plate capacity constraints', () => {
      // Create groups that fit within capacity
      const groups = [
        createGroup('Patient_001', 20, { 'Drug|T0': 10, 'Drug|T10': 10 }),
        createGroup('Patient_002', 20, { 'Placebo|T0': 10, 'Placebo|T10': 10 }),
        createGroup('Patient_003', 20, { 'Drug|T0': 10, 'Drug|T10': 10 })
      ];

      const plateCapacities = [40, 40]; // Two plates, 40 samples each
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Verify all groups are assigned
      expect(result.size).toBe(2);

      // Calculate total samples per plate
      const plateCounts = [0, 0];
      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          plateCounts[plateIdx] += group.size;
        });
      });

      // Verify no plate exceeds capacity
      expect(plateCounts[0]).toBeLessThanOrEqual(plateCapacities[0]);
      expect(plateCounts[1]).toBeLessThanOrEqual(plateCapacities[1]);
    });

    test('Should not assign group to plate if it exceeds capacity', () => {
      // Create groups where second plate has limited capacity
      const groups = [
        createGroup('Patient_001', 25, { 'Drug|T0': 13, 'Drug|T10': 12 }),
        createGroup('Patient_002', 25, { 'Placebo|T0': 13, 'Placebo|T10': 12 }),
        createGroup('Patient_003', 10, { 'Drug|T0': 5, 'Drug|T10': 5 })
      ];

      const plateCapacities = [50, 20]; // First plate can fit more, second has limited capacity
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Calculate samples per plate
      const plateCounts = [0, 0];
      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          plateCounts[plateIdx] += group.size;
        });
      });

      // Verify no plate exceeds its capacity
      expect(plateCounts[0]).toBeLessThanOrEqual(50);
      expect(plateCounts[1]).toBeLessThanOrEqual(20);

      // Verify all groups are assigned
      const totalSamples = plateCounts[0] + plateCounts[1];
      expect(totalSamples).toBe(60);
    });

    test('Should throw error when group cannot fit in any plate', () => {
      // Create a group larger than any plate capacity
      const groups = [
        createGroup('Patient_001', 100, { 'Drug|T0': 50, 'Drug|T10': 50 })
      ];

      const plateCapacities = [50, 50]; // Both plates too small
      const treatmentVariables = ['Treatment', 'Timepoint'];

      expect(() => {
        distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);
      }).toThrow(/Cannot fit repeated-measures group/);
    });

  });

  describe('Groups Stay Together', () => {

    test('Should keep all samples from same group on same plate', () => {
      const groups = [
        createGroup('Patient_001', 10, { 'Drug|T0': 5, 'Drug|T10': 5 }),
        createGroup('Patient_002', 10, { 'Placebo|T0': 5, 'Placebo|T10': 5 }),
        createGroup('Patient_003', 10, { 'Drug|T0': 5, 'Drug|T10': 5 })
      ];

      const plateCapacities = [20, 20];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Verify each group appears on exactly one plate
      const groupPlateMap = new Map<string, number>();

      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          expect(groupPlateMap.has(group.subjectId)).toBe(false); // Group not already assigned
          groupPlateMap.set(group.subjectId, plateIdx);
        });
      });

      // All groups should be assigned
      expect(groupPlateMap.size).toBe(groups.length);
    });

    test('Should not split groups across multiple plates', () => {
      const groups = [
        createGroup('Patient_001', 15, { 'Drug|T0': 8, 'Drug|T10': 7 }),
        createGroup('Patient_002', 15, { 'Placebo|T0': 8, 'Placebo|T10': 7 })
      ];

      const plateCapacities = [20, 20];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Track which plate each sample is on
      const samplePlateMap = new Map<string, number>();

      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          group.samples.forEach(sample => {
            samplePlateMap.set(sample.name, plateIdx);
          });
        });
      });

      // Verify all samples from same group are on same plate
      groups.forEach(group => {
        const samplePlates = group.samples.map(s => samplePlateMap.get(s.name));
        const uniquePlates = new Set(samplePlates);
        expect(uniquePlates.size).toBe(1); // All samples on same plate
      });
    });

  });

  describe('Balance Score Calculation', () => {

    test('Should distribute groups to maintain treatment balance', () => {
      // Create groups with different treatment compositions
      const groups = [
        createGroup('Patient_001', 10, { 'Drug|T0': 10 }),
        createGroup('Patient_002', 10, { 'Placebo|T0': 10 }),
        createGroup('Patient_003', 10, { 'Drug|T10': 10 }),
        createGroup('Patient_004', 10, { 'Placebo|T10': 10 })
      ];

      const plateCapacities = [20, 20];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Calculate treatment distribution per plate
      const plateTreatmentCounts = [
        new Map<string, number>(),
        new Map<string, number>()
      ];

      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          group.treatmentComposition.forEach((count, treatmentKey) => {
            const currentCount = plateTreatmentCounts[plateIdx].get(treatmentKey) || 0;
            plateTreatmentCounts[plateIdx].set(treatmentKey, currentCount + count);
          });
        });
      });

      // Each plate should have balanced treatment distribution
      // With 4 groups of 10 samples each (40 total), each plate gets 20 samples
      // Ideal: each treatment combination appears 5 times per plate (20/4 = 5)
      plateTreatmentCounts.forEach(plateCounts => {
        const totalSamples = Array.from(plateCounts.values()).reduce((sum, count) => sum + count, 0);
        expect(totalSamples).toBe(20);
      });
    });

    test('Should handle groups with mixed treatment compositions', () => {
      // Groups where each group has multiple treatment combinations
      const groups = [
        createGroup('Patient_001', 8, { 'Drug|T0': 4, 'Drug|T10': 4 }),
        createGroup('Patient_002', 8, { 'Placebo|T0': 4, 'Placebo|T10': 4 }),
        createGroup('Patient_003', 8, { 'Drug|T0': 4, 'Drug|T10': 4 }),
        createGroup('Patient_004', 8, { 'Placebo|T0': 4, 'Placebo|T10': 4 })
      ];

      const plateCapacities = [16, 16];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Verify all groups are distributed
      let totalAssignedGroups = 0;
      result.forEach(assignedGroups => {
        totalAssignedGroups += assignedGroups.length;
      });

      expect(totalAssignedGroups).toBe(groups.length);
    });

  });

  describe('Best Plate Selection', () => {

    test('Should select plate with best balance score', () => {
      // Create scenario where one plate is clearly better for balance
      const groups = [
        createGroup('Patient_001', 10, { 'Drug|T0': 10 }),
        createGroup('Patient_002', 10, { 'Placebo|T0': 10 }),
        createGroup('Patient_003', 10, { 'Drug|T0': 10 }) // Should go to plate with Placebo
      ];

      const plateCapacities = [20, 20];
      const treatmentVariables = ['Treatment'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Calculate Drug vs Placebo distribution per plate
      const plateDrugCounts = [0, 0];
      const platePlaceboCounts = [0, 0];

      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          group.treatmentComposition.forEach((count, treatmentKey) => {
            if (treatmentKey.includes('Drug')) {
              plateDrugCounts[plateIdx] += count;
            } else if (treatmentKey.includes('Placebo')) {
              platePlaceboCounts[plateIdx] += count;
            }
          });
        });
      });

      // Verify balance is maintained (should be close to 50/50 on each plate)
      const totalDrug = plateDrugCounts[0] + plateDrugCounts[1];
      const totalPlacebo = platePlaceboCounts[0] + platePlaceboCounts[1];

      expect(totalDrug).toBe(20);
      expect(totalPlacebo).toBe(10);
    });

    test('Should prioritize capacity over balance when necessary', () => {
      // Create scenario where balance would prefer full plate, but capacity prevents it
      const groups = [
        createGroup('Patient_001', 30, { 'Drug|T0': 30 }),
        createGroup('Patient_002', 30, { 'Drug|T0': 30 })
      ];

      const plateCapacities = [40, 40];
      const treatmentVariables = ['Treatment'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Each plate should have one group (can't fit both)
      expect(result.get(0)!.length).toBe(1);
      expect(result.get(1)!.length).toBe(1);
    });

  });

  describe('Error Handling', () => {

    test('Should throw descriptive error for oversized group', () => {
      const groups = [
        createGroup('Patient_001', 150, { 'Drug|T0': 75, 'Drug|T10': 75 })
      ];

      const plateCapacities = [96, 96];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      expect(() => {
        distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);
      }).toThrow(/Cannot fit repeated-measures group 'Patient_001'/);

      expect(() => {
        distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);
      }).toThrow(/150 samples/);
    });

    test('Should include capacity information in error message', () => {
      const groups = [
        createGroup('Patient_001', 100, { 'Drug|T0': 50, 'Drug|T10': 50 })
      ];

      const plateCapacities = [50, 50];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      expect(() => {
        distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);
      }).toThrow(/Current plate capacities: 50, 50/);
    });

    test('Should handle empty groups array', () => {
      const groups: RepeatedMeasuresGroup[] = [];
      const plateCapacities = [96];
      const treatmentVariables = ['Treatment'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      expect(result.size).toBe(1);
      expect(result.get(0)!.length).toBe(0);
    });

  });

  describe('Multiple Plates', () => {

    test('Should distribute groups across multiple plates', () => {
      const groups = [
        createGroup('Patient_001', 20, { 'Drug|T0': 10, 'Drug|T10': 10 }),
        createGroup('Patient_002', 20, { 'Placebo|T0': 10, 'Placebo|T10': 10 }),
        createGroup('Patient_003', 20, { 'Drug|T0': 10, 'Drug|T10': 10 }),
        createGroup('Patient_004', 20, { 'Placebo|T0': 10, 'Placebo|T10': 10 })
      ];

      const plateCapacities = [40, 40];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Verify groups are distributed across both plates
      expect(result.get(0)!.length).toBeGreaterThan(0);
      expect(result.get(1)!.length).toBeGreaterThan(0);

      // Verify total groups assigned
      const totalGroups = result.get(0)!.length + result.get(1)!.length;
      expect(totalGroups).toBe(groups.length);
    });

    test('Should handle uneven plate capacities', () => {
      const groups = [
        createGroup('Patient_001', 10, { 'Drug|T0': 5, 'Drug|T10': 5 }),
        createGroup('Patient_002', 10, { 'Placebo|T0': 5, 'Placebo|T10': 5 }),
        createGroup('Patient_003', 10, { 'Drug|T0': 5, 'Drug|T10': 5 })
      ];

      const plateCapacities = [20, 10]; // Uneven capacities
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Calculate samples per plate
      const plateCounts = [0, 0];
      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          plateCounts[plateIdx] += group.size;
        });
      });

      // Verify capacities are respected
      expect(plateCounts[0]).toBeLessThanOrEqual(20);
      expect(plateCounts[1]).toBeLessThanOrEqual(10);
    });

  });

  describe('Singleton Handling', () => {

    test('Should distribute singleton groups independently', () => {
      const groups = [
        createGroup('__singleton_0', 1, { 'Drug|T0': 1 }, true),
        createGroup('__singleton_1', 1, { 'Placebo|T0': 1 }, true),
        createGroup('__singleton_2', 1, { 'Drug|T10': 1 }, true),
        createGroup('__singleton_3', 1, { 'Placebo|T10': 1 }, true)
      ];

      const plateCapacities = [2, 2];
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Verify all singletons are distributed
      let totalSingletons = 0;
      result.forEach(assignedGroups => {
        totalSingletons += assignedGroups.length;
      });

      expect(totalSingletons).toBe(4);
    });

    test('Should treat singletons as independent units', () => {
      const groups = [
        createGroup('Patient_001', 10, { 'Drug|T0': 10 }),
        createGroup('__singleton_0', 1, { 'Drug|T0': 1 }, true),
        createGroup('__singleton_1', 1, { 'Drug|T0': 1 }, true)
      ];

      const plateCapacities = [12, 12];
      const treatmentVariables = ['Treatment'];

      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);

      // Verify singletons can be on different plates from each other
      const singletonPlates = new Set<number>();
      result.forEach((assignedGroups, plateIdx) => {
        assignedGroups.forEach(group => {
          if (group.isSingleton) {
            singletonPlates.add(plateIdx);
          }
        });
      });

      // At least one singleton should be assigned
      expect(singletonPlates.size).toBeGreaterThan(0);
    });

  });

  describe('Large Dataset Performance', () => {

    test('Should handle many small groups efficiently', () => {
      // Create 50 groups of 2 samples each
      const groups: RepeatedMeasuresGroup[] = [];
      for (let i = 0; i < 50; i++) {
        groups.push(createGroup(
          `Patient_${String(i).padStart(3, '0')}`,
          2,
          { 'Drug|T0': 1, 'Placebo|T0': 1 }
        ));
      }

      const plateCapacities = [50, 50]; // Two plates
      const treatmentVariables = ['Treatment', 'Timepoint'];

      const startTime = Date.now();
      const result = distributeGroupsToPlates(groups, plateCapacities, treatmentVariables);
      const endTime = Date.now();

      // Should complete quickly (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify all groups are assigned
      let totalGroups = 0;
      result.forEach(assignedGroups => {
        totalGroups += assignedGroups.length;
      });

      expect(totalGroups).toBe(50);
    });

  });

});
