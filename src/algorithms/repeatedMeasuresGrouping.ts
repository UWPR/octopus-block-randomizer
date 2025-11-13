import { SearchData, RepeatedMeasuresGroup } from '../utils/types';
import { getCovariateKey } from '../utils/utils';

/**
 * Creates repeated-measures groups from samples
 *
 * @param samples All samples to be randomized
 * @param repeatedMeasuresVariable Variable used for grouping (e.g., "PatientID")
 * @param treatmentVariables Variables used for treatment balancing
 * @returns Array of repeated-measures groups
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

  // Step 1: Group samples by subject ID
  const subjectMap = new Map<string, SearchData[]>();
  let singletonCounter = 0;

  samples.forEach(sample => {
    const subjectId = sample.metadata[repeatedMeasuresVariable];

    if (!subjectId || subjectId.trim() === '') {
      // Create unique singleton ID for samples without subject ID
      const singletonId = `__singleton_${singletonCounter++}`;
      subjectMap.set(singletonId, [sample]);
    } else {
      // Group samples with the same subject ID
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, []);
      }
      subjectMap.get(subjectId)!.push(sample);
    }
  });

  console.log(`  - Unique subject IDs found: ${subjectMap.size - singletonCounter}`);
  console.log(`  - Samples without subject ID (singletons): ${singletonCounter}`);

  // Step 2: Convert to RepeatedMeasuresGroup objects
  const groups: RepeatedMeasuresGroup[] = [];

  subjectMap.forEach((groupSamples, subjectId) => {
    // Calculate treatment composition for this group
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

    groups.push(group);
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
 * Validates repeated-measures groups for common issues
 *
 * @param groups Groups to validate
 * @param plateCapacity Maximum samples per plate
 * @returns Validation result with errors and warnings
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

  // Check for oversized groups (exceeds plate capacity)
  console.log(`  - Checking for oversized groups (> ${plateCapacity} samples)...`);
  const oversizedGroups = groups.filter(g => g.size > plateCapacity);
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

  // Warn about large groups (> 50% of plate capacity)
  const largeThreshold = plateCapacity * 0.5;
  console.log(`  - Checking for large groups (> ${largeThreshold} samples, ${(50).toFixed(0)}% of capacity)...`);
  const largeGroups = groups.filter(
    g => g.size > plateCapacity * 0.5 && g.size <= plateCapacity
  );
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

  // Warn about high singleton ratio (> 80%)
  console.log(`  - Checking singleton ratio...`);
  const singletonCount = groups.filter(g => g.isSingleton).length;
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
