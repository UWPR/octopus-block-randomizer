import { RepeatedMeasuresGroup } from '../utils/types';

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

  // Step 4: Distribute each group to the best plate
  console.log(`\nDistributing groups to plates...`);

  for (const group of sortedGroups) {
    // Find the best plate for this group
    const bestPlateIdx = selectBestPlate(
      group,
      plateCapacities,
      plateCounts,
      plateAssignments,
      globalTreatmentCounts,
      totalSamples
    );

    // Assign group to the best plate
    plateAssignments.get(bestPlateIdx)!.push(group);
    plateCounts[bestPlateIdx] += group.size;

    console.log(
      `  - Assigned group ${group.subjectId} (${group.size} samples) to plate ${bestPlateIdx + 1} ` +
      `(now ${plateCounts[bestPlateIdx]}/${plateCapacities[bestPlateIdx]} samples)`
    );
  }

  // Log final distribution summary
  console.log(`\nFinal distribution:`);
  for (let i = 0; i < plateCapacities.length; i++) {
    const groups = plateAssignments.get(i)!;
    console.log(
      `  - Plate ${i + 1}: ${groups.length} groups, ${plateCounts[i]} samples ` +
      `(${((plateCounts[i] / plateCapacities[i]) * 100).toFixed(1)}% full)`
    );
  }

  return plateAssignments;
}

/**
 * Selects the best plate for a group based on capacity constraints and balance score
 *
 * Algorithm:
 * 1. Check capacity constraints for each candidate plate
 * 2. Calculate balance score for each viable plate
 * 3. Select plate with lowest balance score (best balance)
 * 4. Throw error if no plate can fit the group
 *
 * @param group Group to assign
 * @param plateCapacities Capacity of each plate
 * @param plateCounts Current sample counts per plate
 * @param currentAssignments Current plate assignments
 * @param globalTreatmentCounts Global treatment distribution
 * @param totalSamples Total number of samples
 * @returns Index of the best plate
 * @throws Error if no plate can fit the group
 */
function selectBestPlate(
  group: RepeatedMeasuresGroup,
  plateCapacities: number[],
  plateCounts: number[],
  currentAssignments: Map<number, RepeatedMeasuresGroup[]>,
  globalTreatmentCounts: Map<string, number>,
  totalSamples: number
): number {
  let bestPlateIdx = -1;
  let bestScore = Infinity;

  // Check each candidate plate
  for (let plateIdx = 0; plateIdx < plateCapacities.length; plateIdx++) {
    // Check capacity constraint
    const remainingCapacity = plateCapacities[plateIdx] - plateCounts[plateIdx];

    if (remainingCapacity < group.size) {
      // Plate cannot fit this group, skip it
      continue;
    }

    // Calculate balance score for this plate
    const score = calculateBalanceScore(
      plateIdx,
      group,
      currentAssignments,
      plateCounts,
      globalTreatmentCounts,
      totalSamples
    );

    // Update best plate if this score is better
    if (score < bestScore) {
      bestScore = score;
      bestPlateIdx = plateIdx;
    }
  }

  // Handle case where no plate can fit the group
  if (bestPlateIdx === -1) {
    throw new Error(
      `Cannot fit repeated-measures group '${group.subjectId}' (${group.size} samples) ` +
      `in any available plate. This may indicate insufficient total capacity or ` +
      `the group is too large for the plate size. ` +
      `Current plate capacities: ${plateCapacities.join(', ')}. ` +
      `Current plate usage: ${plateCounts.map((count, idx) =>
        `${count}/${plateCapacities[idx]}`
      ).join(', ')}.`
    );
  }

  return bestPlateIdx;
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
