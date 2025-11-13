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
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│           DISTRIBUTION INITIALIZATION                       │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  console.log(`Distributing ${groups.length} groups to ${plateCapacities.length} plates`);
  console.log(`Plate capacities: ${plateCapacities.join(', ')}`);

  // Step 1: Calculate global treatment distribution from all samples
  console.log(`\nStep 1: Calculating global treatment distribution...`);
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

  console.log(`  ✓ Total samples: ${totalSamples}`);
  console.log(`  ✓ Treatment combinations found: ${globalTreatmentCounts.size}`);
  console.log(`\n  Global treatment distribution:`);
  globalTreatmentCounts.forEach((count, key) => {
    const proportion = ((count / totalSamples) * 100).toFixed(1);
    console.log(`    - ${key}: ${count} samples (${proportion}%)`);
  });

  // Step 2: Sort groups by size (largest first) for better bin packing
  console.log(`\nStep 2: Sorting groups by size (largest first)...`);
  const sortedGroups = [...groups].sort((a, b) => b.size - a.size);
  console.log(`  ✓ Sorted ${sortedGroups.length} groups`);
  console.log(`\n  Largest groups (top ${Math.min(5, sortedGroups.length)}):`);
  sortedGroups.slice(0, 5).forEach((g, idx) => {
    console.log(`    ${idx + 1}. ${g.subjectId}: ${g.size} samples`);
  });
  if (sortedGroups.length > 5) {
    console.log(`    ... and ${sortedGroups.length - 5} more groups`);
  }

  // Step 3: Initialize plate assignments and tracking
  console.log(`\nStep 3: Initializing plate assignments...`);
  const plateAssignments = new Map<number, RepeatedMeasuresGroup[]>();
  const plateCounts = new Array(plateCapacities.length).fill(0);

  // Initialize empty arrays for each plate
  for (let i = 0; i < plateCapacities.length; i++) {
    plateAssignments.set(i, []);
  }

  console.log(`  ✓ Initialized ${plateCapacities.length} plates for distribution`);

  // Step 4: Distribute each group to the best plate
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│           DISTRIBUTION PROGRESS                             │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  console.log(`Distributing groups to plates (greedy best-fit algorithm)...\n`);

  let groupCounter = 0;
  for (const group of sortedGroups) {
    groupCounter++;

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

    const fillPercentage = ((plateCounts[bestPlateIdx] / plateCapacities[bestPlateIdx]) * 100).toFixed(1);
    const remainingCapacity = plateCapacities[bestPlateIdx] - plateCounts[bestPlateIdx];

    // Log progress for every group (or every 10th group if there are many)
    if (sortedGroups.length <= 20 || groupCounter % 10 === 0 || groupCounter === sortedGroups.length) {
      console.log(
        `[${groupCounter}/${sortedGroups.length}] Assigned ${group.subjectId} (${group.size} samples) → Plate ${bestPlateIdx + 1} ` +
        `[${plateCounts[bestPlateIdx]}/${plateCapacities[bestPlateIdx]} samples, ${fillPercentage}% full, ${remainingCapacity} remaining]`
      );
    }
  }

  // Log final distribution summary
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│           DISTRIBUTION SUMMARY                              │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  console.log(`Distribution complete! Final plate assignments:\n`);

  for (let i = 0; i < plateCapacities.length; i++) {
    const assignedGroups = plateAssignments.get(i)!;
    const fillPercentage = ((plateCounts[i] / plateCapacities[i]) * 100).toFixed(1);
    const remainingCapacity = plateCapacities[i] - plateCounts[i];

    console.log(`Plate ${i + 1}:`);
    console.log(`  ✓ Groups assigned: ${assignedGroups.length}`);
    console.log(`  ✓ Total samples: ${plateCounts[i]}/${plateCapacities[i]} (${fillPercentage}% full)`);
    console.log(`  ✓ Remaining capacity: ${remainingCapacity} samples`);

    // Show treatment distribution for this plate
    const plateTreatmentCounts = new Map<string, number>();
    assignedGroups.forEach(g => {
      g.treatmentComposition.forEach((count, key) => {
        plateTreatmentCounts.set(key, (plateTreatmentCounts.get(key) || 0) + count);
      });
    });

    console.log(`  ✓ Treatment distribution:`);
    plateTreatmentCounts.forEach((count, key) => {
      const expectedProportion = (globalTreatmentCounts.get(key) || 0) / totalSamples;
      const expectedCount = expectedProportion * plateCounts[i];
      const deviation = count - expectedCount;
      const deviationSign = deviation >= 0 ? '+' : '';
      console.log(`    - ${key}: ${count} samples (expected: ${expectedCount.toFixed(1)}, deviation: ${deviationSign}${deviation.toFixed(1)})`);
    });
    console.log('');
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
