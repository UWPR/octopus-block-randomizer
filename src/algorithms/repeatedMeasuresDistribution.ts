import { RepeatedMeasuresGroup } from '../utils/types';

/**
 * Distributes repeated-measures groups to plates using a balanced best-fit greedy algorithm.
 *
 * This function implements the core distribution algorithm that assigns repeated-measures groups
 * to plates while maintaining approximate treatment balance across plates and respecting capacity
 * constraints. The algorithm uses a greedy approach with balance scoring to make locally optimal
 * decisions that result in good global balance.
 *
 * **Algorithm Steps:**
 * 1. **Calculate Global Distribution:** Compute the overall treatment proportions across all samples
 *    to establish target proportions for each plate
 * 2. **Sort Groups:** Order groups by size (largest first) for better bin packing efficiency
 * 3. **Initialize Tracking:** Set up plate assignments and cached treatment compositions
 * 4. **Greedy Assignment:** For each group in sorted order:
 *    - Evaluate all plates that have sufficient capacity
 *    - Calculate balance score for adding group to each candidate plate
 *    - Assign group to plate with lowest balance score (best balance)
 *    - Update cached compositions incrementally
 * 5. **Return Assignments:** Provide final mapping of plates to groups
 *
 * **Performance Optimizations:**
 * - Pre-calculates global treatment distribution once (O(n)) instead of recalculating per group
 * - Uses Map data structures for O(1) lookups instead of array searches
 * - Caches plate treatment compositions and updates incrementally (avoids O(n) recalculation)
 * - Implements early termination in balance scoring when perfect balance (score = 0) is found
 * - Sorts groups once upfront rather than repeatedly during distribution
 * - Pre-allocates data structures with known sizes
 *
 * **Balance Scoring:**
 * The algorithm calculates a balance score for each candidate plate by:
 * - Computing hypothetical treatment composition if group were added
 * - Comparing to expected proportions based on global distribution
 * - Summing absolute deviations across all treatment combinations
 * - Lower score = better balance (0 = perfect balance)
 *
 * **Example Usage:**
 * ```typescript
 * const groups = createRepeatedMeasuresGroups(samples, 'PatientID', ['Treatment']);
 * const plateCapacities = [96, 96, 48]; // 2 full plates, 1 partial
 * const assignments = distributeGroupsToPlates(groups, plateCapacities, ['Treatment']);
 *
 * // assignments is a Map:
 * // 0 -> [group1, group3, group5, ...] (groups assigned to plate 1)
 * // 1 -> [group2, group4, group7, ...] (groups assigned to plate 2)
 * // 2 -> [group6, group8, ...]         (groups assigned to plate 3)
 * ```
 *
 * **Capacity Handling:**
 * - Plates can have different capacities (e.g., last plate may be partial)
 * - Algorithm checks capacity constraints before calculating balance scores
 * - Groups that don't fit are excluded from consideration for that plate
 * - If no plate can fit a group, an error is thrown with diagnostic information
 *
 * **Edge Cases:**
 * - Single plate: All groups assigned to that plate (balance is automatic)
 * - Empty groups array: Returns empty assignments for all plates
 * - Group larger than any plate: Throws error with detailed message
 * - Perfect balance achievable: Early termination optimization activates
 * - Rare treatment groups: Handles fractional expected counts correctly
 *
 * **Limitations:**
 * - Greedy algorithm may not find globally optimal solution (but is fast and effective)
 * - Does not perform post-distribution optimization (e.g., swapping groups between plates)
 * - Assumes all groups must be assigned (no optional groups)
 * - Does not consider spatial constraints or batch effects
 * - Balance is approximate, not guaranteed to be perfect (especially with large groups)
 *
 * **Rare Treatment Groups:**
 * The algorithm correctly handles rare treatment combinations (e.g., 4 samples across 7 plates):
 * - Expected count per plate will be fractional (e.g., 0.57 samples)
 * - Balance score calculation uses these fractional values
 * - Some plates will have 0, others will have 1+ (depending on group composition)
 * - This is expected behavior - perfect balance is impossible with rare groups
 *
 * @param groups - Array of repeated-measures groups to distribute. Each group contains samples
 *                that must stay together on the same plate.
 * @param plateCapacities - Array of plate capacities (number of samples per plate). Length determines
 *                         number of plates. Values can differ (e.g., [96, 96, 48] for 2 full + 1 partial).
 * @param treatmentVariables - Array of metadata field names used for treatment balancing (e.g., ["Treatment", "Timepoint"]).
 *                            Used to calculate balance scores and maintain proportional distribution.
 * @returns Map where keys are plate indices (0-based) and values are arrays of groups assigned to that plate.
 *          All groups in the input array will be assigned to exactly one plate.
 *
 * @throws {Error} If any group cannot fit in any available plate due to capacity constraints.
 *                The error message includes diagnostic information about group size and plate capacities.
 *
 * @see {@link selectBestPlate} for the plate selection logic
 * @see {@link calculateBalanceScore} for balance score calculation
 * @see {@link createRepeatedMeasuresGroups} for group creation
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

  // Step 1: Calculate global treatment distribution from all samples (OPTIMIZATION: pre-calculate once)
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

  // Step 3: Initialize plate assignments and tracking (OPTIMIZATION: use Map for O(1) lookups)
  console.log(`\nStep 3: Initializing plate assignments...`);
  const plateAssignments = new Map<number, RepeatedMeasuresGroup[]>();
  const plateCounts = new Array(plateCapacities.length).fill(0);

  // OPTIMIZATION: Cache plate treatment compositions to avoid recalculation
  const plateTreatmentCompositions = new Map<number, Map<string, number>>();

  // Initialize empty arrays and compositions for each plate
  for (let i = 0; i < plateCapacities.length; i++) {
    plateAssignments.set(i, []);
    plateTreatmentCompositions.set(i, new Map<string, number>());
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

    // Find the best plate for this group (OPTIMIZATION: uses cached compositions)
    const bestPlateIdx = selectBestPlate(
      group,
      plateCapacities,
      plateCounts,
      plateTreatmentCompositions,
      globalTreatmentCounts,
      totalSamples
    );

    // Assign group to the best plate
    plateAssignments.get(bestPlateIdx)!.push(group);
    plateCounts[bestPlateIdx] += group.size;

    // OPTIMIZATION: Update cached composition incrementally
    const plateComposition = plateTreatmentCompositions.get(bestPlateIdx)!;
    group.treatmentComposition.forEach((count, treatmentKey) => {
      plateComposition.set(
        treatmentKey,
        (plateComposition.get(treatmentKey) || 0) + count
      );
    });

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

    // Show treatment distribution for this plate (use cached composition)
    const plateTreatmentCounts = plateTreatmentCompositions.get(i)!;

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
 * Selects the best plate for a repeated-measures group based on capacity and treatment balance.
 *
 * This function evaluates all candidate plates to find the one that can accommodate the group
 * while maintaining the best treatment balance. It uses a two-phase approach: first filtering
 * by capacity constraints, then selecting based on balance scores.
 *
 * **Algorithm:**
 * 1. **Capacity Check:** For each plate, verify sufficient remaining capacity (early exit optimization)
 * 2. **Balance Scoring:** Calculate balance score for each viable plate
 * 3. **Best Selection:** Track plate with lowest balance score
 * 4. **Early Termination:** Stop immediately if perfect balance (score = 0) is found
 * 5. **Error Handling:** Throw detailed error if no plate can accommodate the group
 *
 * **Selection Criteria:**
 * - Primary: Plate must have sufficient remaining capacity
 * - Secondary: Among viable plates, select one with lowest balance score
 * - Tie-breaking: First plate encountered with best score wins (deterministic)
 *
 * **Performance Optimizations:**
 * - Checks capacity constraint first (cheap operation) before expensive balance calculation
 * - Early termination when perfect balance (score = 0) is achieved
 * - Uses cached treatment compositions (passed in) to avoid recalculation
 * - Short-circuits loop when optimal solution is found
 *
 * **Example Usage:**
 * ```typescript
 * const bestPlate = selectBestPlate(
 *   group,                          // Group with 8 samples
 *   [96, 96, 48],                  // Plate capacities
 *   [80, 90, 40],                  // Current counts
 *   plateTreatmentCompositions,    // Cached compositions
 *   globalTreatmentCounts,         // Global distribution
 *   240                            // Total samples
 * );
 * // Returns: 0 (plate 1 has most capacity and best balance)
 * ```
 *
 * **Capacity Constraint Logic:**
 * ```
 * remainingCapacity = plateCapacity - currentCount
 * if (remainingCapacity < group.size) {
 *   skip this plate (cannot fit)
 * }
 * ```
 *
 * **Balance Score Comparison:**
 * - Score represents total deviation from expected treatment proportions
 * - Lower score = better balance
 * - Score of 0 = perfect balance (rare but possible)
 * - Typical scores range from 0.5 to 10+ depending on group size and composition
 *
 * **Edge Cases:**
 * - All plates full: Throws error with current usage information
 * - Only one viable plate: Returns that plate without comparison
 * - Multiple plates with same score: Returns first one encountered
 * - Perfect balance achievable: Returns immediately without checking remaining plates
 * - Group larger than all plates: Throws error with diagnostic details
 *
 * **Error Handling:**
 * If no plate can fit the group, throws a detailed error including:
 * - Group identifier and size
 * - All plate capacities
 * - Current usage for each plate
 * - Suggestions for resolution (increase capacity or split group)
 *
 * **Limitations:**
 * - Does not consider future groups (greedy approach)
 * - Does not attempt to reserve space for large groups coming later
 * - Tie-breaking is deterministic but arbitrary (first plate wins)
 * - Does not consider spatial or batch constraints
 *
 * @param group - The repeated-measures group to assign. Must have size and treatmentComposition properties.
 * @param plateCapacities - Array of maximum samples per plate (e.g., [96, 96, 48]).
 * @param plateCounts - Array of current sample counts per plate (e.g., [80, 90, 40]).
 * @param plateTreatmentCompositions - Map of plate index to cached treatment composition.
 *                                     Used to avoid recalculating compositions from scratch.
 * @param globalTreatmentCounts - Map of treatment combination keys to total counts across all samples.
 *                               Defines target proportions for balancing.
 * @param totalSamples - Total number of samples across all groups. Used to calculate expected proportions.
 * @returns Zero-based index of the best plate for this group (0 = first plate, 1 = second plate, etc.).
 *
 * @throws {Error} If no plate has sufficient capacity to fit the group. Error includes diagnostic information
 *                about group size, plate capacities, and current usage to help troubleshoot the issue.
 *
 * @see {@link calculateBalanceScore} for balance score calculation details
 * @see {@link distributeGroupsToPlates} for the overall distribution algorithm
 */
function selectBestPlate(
  group: RepeatedMeasuresGroup,
  plateCapacities: number[],
  plateCounts: number[],
  plateTreatmentCompositions: Map<number, Map<string, number>>,
  globalTreatmentCounts: Map<string, number>,
  totalSamples: number
): number {
  let bestPlateIdx = -1;
  let bestScore = Infinity;

  // Check each candidate plate
  for (let plateIdx = 0; plateIdx < plateCapacities.length; plateIdx++) {
    // OPTIMIZATION: Check capacity constraint first (early exit)
    const remainingCapacity = plateCapacities[plateIdx] - plateCounts[plateIdx];

    if (remainingCapacity < group.size) {
      // Plate cannot fit this group, skip it
      continue;
    }

    // Calculate balance score for this plate (uses cached composition)
    const score = calculateBalanceScore(
      plateIdx,
      group,
      plateTreatmentCompositions,
      plateCounts,
      globalTreatmentCounts,
      totalSamples
    );

    // Update best plate if this score is better
    if (score < bestScore) {
      bestScore = score;
      bestPlateIdx = plateIdx;

      // OPTIMIZATION: Early termination if perfect balance achieved
      if (bestScore === 0) {
        break;
      }
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
 * Calculates treatment balance score for adding a group to a plate.
 *
 * This function computes a numerical score that represents how much adding a specific group
 * to a specific plate would deviate from ideal treatment balance. The score is based on
 * comparing the hypothetical treatment composition (current + candidate group) against
 * expected proportions derived from the global treatment distribution.
 *
 * **Balance Score Interpretation:**
 * - **Lower score = better balance** (closer to expected proportions)
 * - **Score of 0 = perfect balance** (actual matches expected exactly)
 * - **Higher score = worse balance** (larger deviation from expected)
 * - Typical scores range from 0.5 to 10+ depending on group size and composition
 *
 * **Algorithm:**
 * 1. **Get Current Composition:** Retrieve cached treatment composition for the plate (O(1) lookup)
 * 2. **Calculate Hypothetical:** Add candidate group's composition to current composition
 * 3. **Compute Expected Counts:** For each treatment combination:
 *    - Calculate global proportion (globalCount / totalSamples)
 *    - Multiply by hypothetical plate size to get expected count
 * 4. **Calculate Deviations:** For each treatment combination:
 *    - Compare actual count to expected count
 *    - Take absolute deviation
 * 5. **Sum Deviations:** Total all deviations to get final balance score
 *
 * **Performance Optimizations:**
 * - Uses cached plate compositions instead of recalculating from all groups (O(1) vs O(n))
 * - Pre-calculated global treatment counts passed in (avoids recalculation)
 * - Direct Map operations for efficient composition merging
 * - Could implement early exit if deviation exceeds threshold (not currently used)
 *
 * **Mathematical Formula:**
 * ```
 * For each treatment combination t:
 *   expectedProportion[t] = globalCount[t] / totalSamples
 *   expectedCount[t] = expectedProportion[t] × hypotheticalPlateSize
 *   actualCount[t] = hypotheticalComposition[t] || 0
 *   deviation[t] = |actualCount[t] - expectedCount[t]|
 *
 * balanceScore = Σ deviation[t] for all t
 * ```
 *
 * **Example Calculation:**
 * ```typescript
 * // Global distribution: 100 Drug, 100 Placebo (200 total)
 * // Plate currently has: 40 Drug, 40 Placebo (80 samples)
 * // Candidate group has: 4 Drug, 4 Placebo (8 samples)
 *
 * // Hypothetical composition: 44 Drug, 44 Placebo (88 samples)
 * // Expected proportions: Drug = 0.5, Placebo = 0.5
 * // Expected counts: Drug = 44, Placebo = 44
 * // Actual counts: Drug = 44, Placebo = 44
 * // Deviations: Drug = 0, Placebo = 0
 * // Balance score = 0 (perfect balance!)
 * ```
 *
 * **Rare Treatment Groups:**
 * The algorithm correctly handles rare treatment combinations with fractional expected counts:
 *
 * ```typescript
 * // Example: 4 samples of rare treatment across 7 plates (672 total samples)
 * // Plate 1 currently has 80 samples, considering group with 8 samples (none rare)
 *
 * // expectedProportion = 4 / 672 = 0.00595
 * // hypotheticalPlateSize = 80 + 8 = 88
 * // expectedCount = 0.00595 × 88 = 0.524 (fractional!)
 * // actualCount = 0 (no rare samples on this plate)
 * // deviation = |0 - 0.524| = 0.524
 *
 * // This small deviation is acceptable and expected for rare groups.
 * // The algorithm will naturally spread rare samples across plates.
 * ```
 *
 * **Edge Cases:**
 * - Empty plate (no current composition): All expected counts are based on group alone
 * - Treatment not in global distribution: Expected count is 0 (shouldn't happen in practice)
 * - Treatment not on plate: Actual count is 0 (common, especially for rare treatments)
 * - Perfect balance achievable: Returns score of 0
 * - Very large group: May result in high score if composition differs from global
 *
 * **Limitations:**
 * - Does not consider future groups (greedy, local decision)
 * - Treats all treatment combinations equally (no weighting)
 * - Does not account for row-level balance (only plate-level)
 * - Fractional expected counts are not rounded (uses exact values)
 * - Does not penalize imbalance more heavily for important treatments
 *
 * @param plateIdx - Zero-based index of the candidate plate being evaluated.
 * @param group - The repeated-measures group being considered for assignment. Must have treatmentComposition and size.
 * @param plateTreatmentCompositions - Map of plate index to cached treatment composition (Map<treatmentKey, count>).
 *                                     Used to avoid recalculating compositions from scratch.
 * @param plateCounts - Array of current sample counts per plate. Used to calculate hypothetical plate size.
 * @param globalTreatmentCounts - Map of treatment combination keys to total counts across all samples.
 *                               Defines the target proportions for balancing.
 * @param totalSamples - Total number of samples across all groups. Used to calculate expected proportions.
 * @returns Balance score as a non-negative number. Lower values indicate better balance.
 *          A score of 0 indicates perfect balance (actual matches expected exactly).
 *
 * @see {@link selectBestPlate} for how this score is used in plate selection
 * @see {@link distributeGroupsToPlates} for the overall distribution algorithm
 */
function calculateBalanceScore(
  plateIdx: number,
  group: RepeatedMeasuresGroup,
  plateTreatmentCompositions: Map<number, Map<string, number>>,
  plateCounts: number[],
  globalTreatmentCounts: Map<string, number>,
  totalSamples: number
): number {
  // Step 1: Get current plate composition from cache (OPTIMIZATION: O(1) lookup)
  const currentComposition = plateTreatmentCompositions.get(plateIdx)!;

  // Step 2: Calculate hypothetical composition (current + candidate group)
  // OPTIMIZATION: Only create new Map, don't iterate through all groups
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
