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

/**
 * Calculates treatment balance score for adding a group to a plate
 *
 * The balance score measures how much adding a group to a plate would deviate
 * from the expected treatment proportions based on global distribution.
 * Lower score = better balance.
 *
 * Algorithm:
 * 1. Calculate current plate composition from already assigned groups
 * 2. Calculate hypothetical composition if we add the candidate group
 * 3. For each treatment combination:
 *    - Calculate expected count based on global proportion
 *    - Calculate deviation from expected count
 * 4. Sum all deviations to get total balance score
 *
 * Handles rare treatment groups with fractional expected counts correctly.
 * For example, if a treatment appears 4 times across 7 plates, expected count
 * per plate is ~0.57, and deviations are calculated from this fractional value.
 *
 * @param plateIdx Index of candidate plate
 * @param group Group to potentially add
 * @param currentAssignments Current plate assignments
 * @param plateCounts Current sample counts per plate
 * @param globalTreatmentCounts Global treatment distribution
 * @param totalSamples Total number of samples
 * @returns Balance score (lower is better)
 */
function calculateBalanceScore(
  plateIdx: number,
  group: RepeatedMeasuresGroup,
  currentAssignments: Map<number, RepeatedMeasuresGroup[]>,
  plateCounts: number[],
  globalTreatmentCounts: Map<string, number>,
  totalSamples: number
): number {
  // Step 1: Calculate current plate composition
  const currentComposition = new Map<string, number>();
  const assignedGroups = currentAssignments.get(plateIdx) || [];

  assignedGroups.forEach(assignedGroup => {
    assignedGroup.treatmentComposition.forEach((count, treatmentKey) => {
      currentComposition.set(
        treatmentKey,
        (currentComposition.get(treatmentKey) || 0) + count
      );
    });
  });

  // Step 2: Calculate hypothetical composition (current + candidate group)
  const hypotheticalComposition = new Map<string, number>(currentComposition);

  group.treatmentComposition.forEach((count, treatmentKey) => {
    hypotheticalComposition.set(
      treatmentKey,
      (hypotheticalComposition.get(treatmentKey) || 0) + count
    );
  });

  // Step 3: Calculate hypothetical plate size
  const hypotheticalPlateSize = plateCounts[plateIdx] + group.size;

  // Step 4: Calculate deviation from expected proportions
  let totalDeviation = 0;

  globalTreatmentCounts.forEach((globalCount, treatmentKey) => {
    // Calculate expected proportion based on global distribution
    const expectedProportion = globalCount / totalSamples;

    // Calculate expected count for this plate size
    const expectedCount = expectedProportion * hypotheticalPlateSize;

    // Get actual count (0 if treatment not present on plate)
    const actualCount = hypotheticalComposition.get(treatmentKey) || 0;

    // Calculate absolute deviation
    const deviation = Math.abs(actualCount - expectedCount);

    totalDeviation += deviation;
  });

  return totalDeviation;
}
