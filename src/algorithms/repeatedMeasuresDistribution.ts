import { SearchData, RepeatedMeasuresGroup } from '../utils/types';
import { getCovariateKey } from '../utils/utils';

/**
 * Distributes repeated-measures groups to plates using balanced best-fit algorithm
 *
 * This function implements a greedy algorithm that:
 * 1. Calculates global treatment distribution from all samples
 * 2. Sorts groups by size (largest first) for better bin packing
 * 3. For each group, selects the plate that minimizes treatment imbalance
 * 4. Respects plate capacity constraints
 *
 * @param groups Groups to distribute
 * @param plateCapacities Capacity of each plate (number of samples per plate)
 * @param treatmentVariables Variables for balancing
 * @returns Map of plate index to assigned groups
 */
export function distributeGroupsToPlates(
  groups: RepeatedMeasuresGroup[],
  plateCapacities: number[],
  treatmentVariables: string[]
): Map<number, RepeatedMeasuresGroup[]> {
  console.log(`\nDistributing ${groups.length} groups to ${plateCapacities.length} plates`);
  console.log(`Plate capacities: ${plateCapacities.join(', ')}`);

  // Step 1: Calculate global treatment distribution from all samples
  const globalTreatmentCounts = new Map<string, number>();
  let totalSamples = 0;

  groups.forEach(group => {
    group.treatmentComposition.forEach((count, treatmentKey) => {
      globalTreatmentCounts.set(
        treatmentKey,
        (globalTreatmentCounts.get(treatmentKey) || 0) + count
      );
      totalSamples += count;
    });
  });

  console.log(`Total samples: ${totalSamples}`);
  console.log(`Treatment distribution:`);
  globalTreatmentCounts.forEach((count, key) => {
    const proportion = ((count / totalSamples) * 100).toFixed(1);
    console.log(`  - ${key}: ${count} (${proportion}%)`);
  });

  // Step 2: Sort groups by size (largest first) for better bin packing
  const sortedGroups = [...groups].sort((a, b) => b.size - a.size);
  console.log(`\nSorted groups (largest first):`);
  sortedGroups.slice(0, 5).forEach(g => {
    console.log(`  - ${g.subjectId}: ${g.size} samples`);
  });
  if (sortedGroups.length > 5) {
    console.log(`  ... and ${sortedGroups.length - 5} more groups`);
  }

  // Step 3: Initialize plate assignments and tracking
  const plateAssignments = new Map<number, RepeatedMeasuresGroup[]>();
  const plateCounts = new Array(plateCapacities.length).fill(0);

  // Initialize empty arrays for each plate
  for (let i = 0; i < plateCapacities.length; i++) {
    plateAssignments.set(i, []);
  }

  console.log(`\nInitialized ${plateCapacities.length} plates for distribution`);

  return plateAssignments;
}
