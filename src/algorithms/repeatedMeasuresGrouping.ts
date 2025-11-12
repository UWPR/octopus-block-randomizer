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

  console.log(`Created ${groups.length} repeated-measures groups from ${samples.length} samples`);
  console.log(`  - Multi-sample groups: ${groups.filter(g => !g.isSingleton).length}`);
  console.log(`  - Singleton groups: ${groups.filter(g => g.isSingleton).length}`);

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
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for oversized groups (exceeds plate capacity)
  const oversizedGroups = groups.filter(g => g.size > plateCapacity);
  if (oversizedGroups.length > 0) {
    oversizedGroups.forEach(group => {
      errors.push(
        `Repeated-measures group '${group.subjectId}' has ${group.size} samples, ` +
        `which exceeds plate capacity of ${plateCapacity}. ` +
        `Please increase plate size or split this group.`
      );
    });
  }

  // Warn about large groups (> 50% of plate capacity)
  const largeGroups = groups.filter(
    g => g.size > plateCapacity * 0.5 && g.size <= plateCapacity
  );
  if (largeGroups.length > 0) {
    largeGroups.forEach(group => {
      const percentage = ((group.size / plateCapacity) * 100).toFixed(1);
      warnings.push(
        `Repeated-measures group '${group.subjectId}' has ${group.size} samples ` +
        `(${percentage}% of plate capacity). Large groups may limit balancing flexibility.`
      );
    });
  }

  // Warn about high singleton ratio (> 80%)
  const singletonCount = groups.filter(g => g.isSingleton).length;
  const singletonRatio = singletonCount / groups.length;
  if (singletonRatio > 0.8 && groups.length > 10) {
    const percentage = (singletonRatio * 100).toFixed(1);
    warnings.push(
      `High proportion of singleton groups (${percentage}%). ` +
      `Consider verifying that the repeated-measures variable is correct for grouping.`
    );
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    console.error('Repeated-measures group validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
  }

  if (warnings.length > 0) {
    console.warn('Repeated-measures group validation warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  return { isValid, errors, warnings };
}
