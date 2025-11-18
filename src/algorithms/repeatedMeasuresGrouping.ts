import { SearchData, RepeatedMeasuresGroup } from '../utils/types';
import { getCovariateKey } from '../utils/utils';

/**
 * Creates repeated-measures groups from samples based on a shared identifier variable.
 *
 * This function groups samples that share the same value for the repeated-measures variable
 * (e.g., PatientID, SubjectID) into groups that must stay together on the same plate.
 * Samples without a value for the repeated-measures variable are treated as independent
 * singletons with unique identifiers. Missing values include: undefined, null, empty strings,
 * whitespace-only strings, and "n/a" (case-insensitive).
 *
 * **Algorithm:**
 * 1. Iterate through all samples once (single pass optimization)
 * 2. Group samples by their repeated-measures variable value using a Map (O(1) lookups)
 * 3. Create unique singleton IDs for samples without a repeated-measures value
 * 4. Calculate treatment composition for each group during creation (pre-calculation optimization)
 * 5. Convert Map entries to RepeatedMeasuresGroup objects with metadata
 *
 * **Performance Optimizations:**
 * - Uses Map for O(1) subject ID lookups instead of array searches
 * - Pre-calculates treatment compositions during group creation to avoid recalculation
 * - Single pass through samples for grouping (O(n) time complexity)
 * - Efficient memory usage with direct array operations and pre-allocated arrays
 * - Avoids redundant iterations by calculating statistics during group creation
 *
 * **Example Usage:**
 * ```typescript
 * const samples = [
 *   { name: 'S1', metadata: { PatientID: 'P001', Treatment: 'Drug' } },
 *   { name: 'S2', metadata: { PatientID: 'P001', Treatment: 'Placebo' } },
 *   { name: 'S3', metadata: { PatientID: 'P002', Treatment: 'Drug' } },
 *   { name: 'S4', metadata: { Treatment: 'Drug' } } // No PatientID - becomes singleton
 * ];
 *
 * const groups = createRepeatedMeasuresGroups(samples, 'PatientID', ['Treatment']);
 * // Returns 3 groups:
 * // - Group 'P001': 2 samples (Drug:1, Placebo:1)
 * // - Group 'P002': 1 sample (Drug:1)
 * // - Group '__singleton_0': 1 sample (Drug:1)
 * ```
 *
 * **Edge Cases:**
 * - Empty samples array: Returns empty array
 * - All samples have same subject ID: Returns single group with all samples
 * - No samples have subject ID: Returns array of singleton groups (one per sample)
 * - Mixed groups and singletons: Handles both correctly
 *
 * **Limitations:**
 * - Subject IDs are case-sensitive and must match exactly
 * - Empty string values are treated as missing (become singletons)
 * - Whitespace-only values are treated as missing (become singletons)
 * - "n/a" values (case-insensitive) are treated as missing (become singletons)
 * - Treatment composition is calculated based on exact string matching of treatment keys
 *
 * @param samples - All samples to be randomized. Each sample must have a metadata object.
 * @param repeatedMeasuresVariable - The metadata field name used for grouping (e.g., "PatientID", "SubjectID").
 *                                   Samples with the same value will be grouped together.
 * @param treatmentVariables - Array of metadata field names used for treatment balancing (e.g., ["Treatment", "Timepoint"]).
 *                            Used to calculate treatment composition within each group.
 * @returns Array of RepeatedMeasuresGroup objects, each containing:
 *          - subjectId: The shared identifier or unique singleton ID
 *          - samples: Array of samples in this group
 *          - treatmentComposition: Map of treatment combination keys to sample counts
 *          - size: Total number of samples in the group
 *          - isSingleton: Boolean indicating if this is a singleton group
 *
 * @throws Does not throw errors, but logs warnings for unusual patterns
 *
 * @see {@link RepeatedMeasuresGroup} for the return type structure
 * @see {@link validateRepeatedMeasuresGroups} for validation of created groups
 */
export function createRepeatedMeasuresGroups(
  samples: SearchData[],
  repeatedMeasuresVariable: string,
  treatmentVariables: string[]
): RepeatedMeasuresGroup[] {
  console.log(`Creating repeated-measures groups...`);
  console.log(`  - Total samples: ${samples.length}`);
  console.log(`  - Grouping variable: ${repeatedMeasuresVariable}`);
  console.log(`  - Treatment variables: ${treatmentVariables.join(', ')}`);

  // Step 1: Group samples by subject ID (OPTIMIZATION: Map for O(1) lookups)
  const subjectMap = new Map<string, SearchData[]>();
  let singletonCounter = 0;

  // OPTIMIZATION: Single pass through samples
  samples.forEach(sample => {
    const subjectId = sample.metadata[repeatedMeasuresVariable];
    const trimmedId = subjectId?.trim() || '';

    // Treat missing, empty, whitespace-only, or "n/a" (case-insensitive) as no subject ID
    const hasNoSubjectId = !subjectId ||
      trimmedId === '' ||
      trimmedId.toLowerCase() === 'n/a';

    if (hasNoSubjectId) {
      // Create unique singleton ID for samples without subject ID
      const singletonId = `__singleton_${singletonCounter++}`;
      subjectMap.set(singletonId, [sample]);
    } else {
      // Group samples with the same subject ID (OPTIMIZATION: O(1) lookup and insert)
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, []);
      }
      subjectMap.get(subjectId)!.push(sample);
    }
  });

  console.log(`  - Unique subject IDs found: ${subjectMap.size - singletonCounter}`);
  console.log(`  - Samples without subject ID (singletons): ${singletonCounter}`);

  // Step 2: Convert to RepeatedMeasuresGroup objects
  // OPTIMIZATION: Pre-allocate array with known size
  const groups: RepeatedMeasuresGroup[] = new Array(subjectMap.size);
  let groupIndex = 0;

  subjectMap.forEach((groupSamples, subjectId) => {
    // OPTIMIZATION: Calculate treatment composition once during group creation
    const treatmentComposition = new Map<string, number>();

    groupSamples.forEach(sample => {
      const treatmentKey = getCovariateKey(sample, treatmentVariables);
      treatmentComposition.set(
        treatmentKey,
        (treatmentComposition.get(treatmentKey) || 0) + 1
      );
    });

    // Create the group object
    const group: RepeatedMeasuresGroup = {
      subjectId,
      samples: groupSamples,
      treatmentComposition,
      size: groupSamples.length,
      isSingleton: subjectId.startsWith('__singleton_')
    };

    groups[groupIndex++] = group;
  });

  // Calculate statistics
  const multiSampleGroups = groups.filter(g => !g.isSingleton);
  const singletonGroups = groups.filter(g => g.isSingleton);
  const groupSizes = multiSampleGroups.map(g => g.size);
  const minGroupSize = groupSizes.length > 0 ? Math.min(...groupSizes) : 0;
  const maxGroupSize = groupSizes.length > 0 ? Math.max(...groupSizes) : 0;
  const avgGroupSize = groupSizes.length > 0
    ? (groupSizes.reduce((sum, size) => sum + size, 0) / groupSizes.length).toFixed(1)
    : '0';

  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│           GROUP CREATION SUMMARY                            │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  console.log(`Total groups created: ${groups.length}`);
  console.log(`  ✓ Multi-sample groups: ${multiSampleGroups.length}`);
  console.log(`  ✓ Singleton groups: ${singletonGroups.length}`);

  if (multiSampleGroups.length > 0) {
    console.log(`\nMulti-sample group statistics:`);
    console.log(`  ✓ Smallest group: ${minGroupSize} samples`);
    console.log(`  ✓ Largest group: ${maxGroupSize} samples`);
    console.log(`  ✓ Average group size: ${avgGroupSize} samples`);
  }

  // Log largest groups for visibility
  if (multiSampleGroups.length > 0) {
    const largestGroups = [...multiSampleGroups]
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);

    console.log(`\nLargest groups (top ${Math.min(5, largestGroups.length)}):`);
    largestGroups.forEach((group, idx) => {
      const treatmentSummary = Array.from(group.treatmentComposition.entries())
        .map(([key, count]) => `${key}:${count}`)
        .join(', ');
      console.log(`  ${idx + 1}. ${group.subjectId}: ${group.size} samples [${treatmentSummary}]`);
    });
  }

  return groups;
}

/**
 * Validates repeated-measures groups for common issues that could prevent successful randomization.
 *
 * This function performs comprehensive validation checks on repeated-measures groups to identify
 * potential problems before attempting distribution. It checks for oversized groups that exceed
 * plate capacity, large groups that may limit balancing flexibility, and high singleton ratios
 * that may indicate incorrect variable selection.
 *
 * **Validation Checks:**
 * 1. **Oversized Groups (Error):** Groups larger than plate capacity cannot be assigned
 * 2. **Large Groups (Warning):** Groups > 50% of plate capacity may limit balancing
 * 3. **High Singleton Ratio (Warning):** > 80% singletons may indicate wrong variable selection
 *
 * **Algorithm:**
 * 1. Pre-calculate validation thresholds once (optimization)
 * 2. Single pass through all groups performing all checks simultaneously (O(n) time)
 * 3. Collect errors and warnings during the pass
 * 4. Generate detailed error/warning messages with actionable guidance
 * 5. Log comprehensive validation summary
 *
 * **Performance Optimizations:**
 * - Single pass through groups for all checks instead of multiple iterations
 * - Pre-calculate thresholds once before the loop
 * - Avoid redundant filtering operations by tracking counts during iteration
 * - Use direct array access instead of filter/map chains
 *
 * **Example Usage:**
 * ```typescript
 * const groups = createRepeatedMeasuresGroups(samples, 'PatientID', ['Treatment']);
 * const validation = validateRepeatedMeasuresGroups(groups, 96);
 *
 * if (!validation.isValid) {
 *   console.error('Validation failed:', validation.errors);
 *   // Handle errors - cannot proceed with randomization
 * }
 *
 * if (validation.warnings.length > 0) {
 *   console.warn('Validation warnings:', validation.warnings);
 *   // Can proceed but user should be aware of potential issues
 * }
 * ```
 *
 * **Validation Rules:**
 * - **Oversized Group:** group.size > plateCapacity
 *   - Severity: ERROR (blocks randomization)
 *   - Reason: Cannot physically fit group on a single plate
 *   - Solution: Increase plate size or split the group
 *
 * - **Large Group:** group.size > plateCapacity * 0.5
 *   - Severity: WARNING (allows randomization)
 *   - Reason: Large groups consume significant plate space, limiting balancing options
 *   - Impact: May result in less optimal treatment balance across plates
 *
 * - **High Singleton Ratio:** singletonCount / totalGroups > 0.8 AND totalGroups > 10
 *   - Severity: WARNING (allows randomization)
 *   - Reason: Most samples are ungrouped, defeating the purpose of repeated-measures
 *   - Solution: Verify correct variable selection (e.g., not using a unique sample ID)
 *
 * **Edge Cases:**
 * - Empty groups array: Returns valid with no errors/warnings
 * - All singletons: Triggers high singleton ratio warning if > 10 groups
 * - All groups same size: No warnings if within capacity
 * - Single group: No singleton warning (< 10 groups threshold)
 *
 * **Limitations:**
 * - Does not validate treatment composition within groups
 * - Does not check for total capacity across all plates
 * - Singleton ratio warning only triggers if > 10 total groups (avoids false positives for small datasets)
 * - Thresholds (50% for large groups, 80% for singleton ratio) are fixed and not configurable
 *
 * @param groups - Array of repeated-measures groups to validate. Each group should have size and isSingleton properties.
 * @param plateCapacity - Maximum number of samples that can fit on a single plate (e.g., 96 for 8x12 plate).
 *                       Used to determine if groups are oversized or large.
 * @returns Validation result object containing:
 *          - isValid: Boolean indicating if validation passed (no errors). False if any errors exist.
 *          - errors: Array of error messages. Non-empty array blocks randomization execution.
 *          - warnings: Array of warning messages. Does not block execution but indicates potential issues.
 *
 * @see {@link createRepeatedMeasuresGroups} for group creation
 * @see {@link RepeatedMeasuresGroup} for group structure
 */
export function validateRepeatedMeasuresGroups(
  groups: RepeatedMeasuresGroup[],
  plateCapacity: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  console.log(`\nValidating repeated-measures groups...`);
  console.log(`  - Total groups to validate: ${groups.length}`);
  console.log(`  - Plate capacity: ${plateCapacity} samples`);

  const errors: string[] = [];
  const warnings: string[] = [];

  // OPTIMIZATION: Pre-calculate thresholds once
  const largeThreshold = plateCapacity * 0.5;

  // OPTIMIZATION: Single pass through groups for all checks
  let singletonCount = 0;
  const oversizedGroups: RepeatedMeasuresGroup[] = [];
  const largeGroups: RepeatedMeasuresGroup[] = [];

  console.log(`  - Analyzing groups (single pass optimization)...`);

  groups.forEach(group => {
    // Count singletons
    if (group.isSingleton) {
      singletonCount++;
    }

    // Check for oversized groups (exceeds plate capacity)
    if (group.size > plateCapacity) {
      oversizedGroups.push(group);
    }
    // Check for large groups (> 50% of plate capacity but <= capacity)
    else if (group.size > largeThreshold) {
      largeGroups.push(group);
    }
  });

  // Report oversized groups
  console.log(`  - Checking for oversized groups (> ${plateCapacity} samples)...`);
  if (oversizedGroups.length > 0) {
    console.error(`    ❌ Found ${oversizedGroups.length} oversized group(s):`);
    oversizedGroups.forEach(group => {
      const errorMsg = `Repeated-measures group '${group.subjectId}' has ${group.size} samples, ` +
        `which exceeds plate capacity of ${plateCapacity}. ` +
        `Please increase plate size or split this group.`;
      errors.push(errorMsg);
      console.error(`       - ${group.subjectId}: ${group.size} samples (exceeds by ${group.size - plateCapacity})`);
    });
  } else {
    console.log(`    ✓ No oversized groups found`);
  }

  // Report large groups
  console.log(`  - Checking for large groups (> ${largeThreshold} samples, ${(50).toFixed(0)}% of capacity)...`);
  if (largeGroups.length > 0) {
    console.warn(`    ⚠ Found ${largeGroups.length} large group(s):`);
    largeGroups.forEach(group => {
      const percentage = ((group.size / plateCapacity) * 100).toFixed(1);
      const warningMsg = `Repeated-measures group '${group.subjectId}' has ${group.size} samples ` +
        `(${percentage}% of plate capacity). Large groups may limit balancing flexibility.`;
      warnings.push(warningMsg);
      console.warn(`       - ${group.subjectId}: ${group.size} samples (${percentage}% of capacity)`);
    });
  } else {
    console.log(`    ✓ No large groups found`);
  }

  // Check singleton ratio
  console.log(`  - Checking singleton ratio...`);
  const singletonRatio = singletonCount / groups.length;
  const singletonPercentage = (singletonRatio * 100).toFixed(1);
  console.log(`    Singleton ratio: ${singletonPercentage}% (${singletonCount}/${groups.length} groups)`);

  if (singletonRatio > 0.8 && groups.length > 10) {
    const warningMsg = `High proportion of singleton groups (${singletonPercentage}%). ` +
      `Consider verifying that the repeated-measures variable is correct for grouping.`;
    warnings.push(warningMsg);
    console.warn(`    ⚠ ${warningMsg}`);
  } else {
    console.log(`    ✓ Singleton ratio is acceptable`);
  }

  const isValid = errors.length === 0;

  // Log validation summary
  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│           VALIDATION RESULTS                                │`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  console.log(`Validation status: ${isValid ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`  - Errors: ${errors.length}`);
  console.log(`  - Warnings: ${warnings.length}`);

  if (!isValid) {
    console.error(`\n❌ Validation failed with ${errors.length} error(s):`);
    errors.forEach((error, idx) => console.error(`  ${idx + 1}. ${error}`));
  }

  if (warnings.length > 0) {
    console.warn(`\n⚠ Validation warnings (${warnings.length}):`);
    warnings.forEach((warning, idx) => console.warn(`  ${idx + 1}. ${warning}`));
  }

  if (isValid && warnings.length === 0) {
    console.log(`\n✓ All validation checks passed successfully!`);
  }

  return { isValid, errors, warnings };
}
