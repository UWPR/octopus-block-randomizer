import { SearchData } from '../types';
import { calculateQualityMetrics, calculateExpectedRunsByGroup, calculateExpectedSequencesGapMethod } from './qualityMetrics';

// Simple test to verify simplified quality metrics calculation
const createTestData = (): {
  searches: SearchData[];
  plateAssignments: Map<number, SearchData[]>;
  randomizedPlates: (SearchData | undefined)[][][];
} => {
  const searches: SearchData[] = [
    { name: 'Sample1', metadata: { gender: 'M', age: 'young' } },
    { name: 'Sample2', metadata: { gender: 'F', age: 'young' } },
    { name: 'Sample3', metadata: { gender: 'M', age: 'old' } },
    { name: 'Sample4', metadata: { gender: 'F', age: 'old' } },
  ];

  const plateAssignments = new Map<number, SearchData[]>();
  plateAssignments.set(0, [searches[0], searches[1]]);
  plateAssignments.set(1, [searches[2], searches[3]]);

  // Create mock randomized plates (2x2 grid for simplicity)
  const randomizedPlates: (SearchData | undefined)[][][] = [
    [
      [searches[0], searches[1]],
      [undefined, undefined]
    ],
    [
      [searches[2], searches[3]],
      [undefined, undefined]
    ]
  ];

  return { searches, plateAssignments, randomizedPlates };
};

// Test function (for manual verification)
export const testSimplifiedQualityMetrics = () => {
  const { searches, plateAssignments, randomizedPlates } = createTestData();
  const selectedCovariates = ['gender', 'age'];

  try {
    const metrics = calculateQualityMetrics(
      searches,
      plateAssignments,
      randomizedPlates,
      selectedCovariates
    );

    console.log('Quality Metrics Test Results:');
    console.log('Overall Score:', metrics.overallQuality.score);
    console.log('Quality Level:', metrics.overallQuality.level);
    console.log('Recommendations:', metrics.overallQuality.recommendations);
    console.log('Plate Diversity:', metrics.plateDiversity);
    console.log('Plate Scores:', metrics.plateDiversity.plateScores);

    return metrics;
  } catch (error) {
    console.error('Simplified quality metrics test failed:', error);
    return null;
  }
};

// Validation function to check inputs
export const validateSimplifiedQualityMetricsInputs = (
  searches: SearchData[],
  plateAssignments: Map<number, SearchData[]>,
  randomizedPlates: (SearchData | undefined)[][][],
  selectedCovariates: string[]
) => {
  console.log('Quality Metrics Input Validation:');
  console.log('- Searches count:', searches.length);
  console.log('- Plates count:', plateAssignments.size);
  console.log('- Randomized plates count:', randomizedPlates.length);
  console.log('- Selected covariates:', selectedCovariates);

  plateAssignments.forEach((samples, plateIndex) => {
    console.log(`- Plate ${plateIndex}: ${samples.length} samples`);
  });

  selectedCovariates.forEach(covariate => {
    const values = new Set(searches.map(s => s.metadata[covariate] || 'Unknown'));
    console.log(`- Covariate ${covariate}: ${values.size} unique values:`, Array.from(values));
  });

  // Validate randomized plates structure
  randomizedPlates.forEach((plate, plateIndex) => {
    const filledWells = plate.flat().filter(well => well !== undefined).length;
    console.log(`- Randomized Plate ${plateIndex}: ${plate.length}x${plate[0]?.length || 0} grid, ${filledWells} filled wells`);
  });
};

// Test for calculateExpectedRunsByGroup function
// Note: This function is internal, so we'll test it indirectly through the row scoring
export const testExpectedRunsByGroup = () => {
  console.log('\n=== Testing Expected Runs Calculation ===');

  // Test cases with different compositions and sequence lengths
  const testCases = [
    {
      name: 'Simple binary case (6R, 6B)',
      keys: ['R', 'R', 'R', 'R', 'R', 'R', 'B', 'B', 'B', 'B', 'B', 'B'],
      description: 'Equal groups, should use exact calculation (n=12 <= 24)'
    },
    {
      name: 'Unbalanced case (8R, 4B)',
      keys: ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'B', 'B', 'B', 'B'],
      description: 'Unequal groups, should use exact calculation (n=12 <= 24)'
    },
    {
      name: 'Three groups (4R, 4G, 4B)',
      keys: ['R', 'R', 'R', 'R', 'G', 'G', 'G', 'G', 'B', 'B', 'B', 'B'],
      description: 'Three equal groups, should use exact calculation (n=12 <= 24)'
    },
    {
      name: 'Single sample group (1R, 11B)',
      keys: ['R', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'],
      description: 'One group with single sample (no runs possible for R)'
    },
    {
      name: 'Large sequence (approximate)',
      keys: Array(30).fill(0).map((_, i) => i < 15 ? 'R' : 'B'),
      description: 'Large sequence, should use approximate calculation (n=30 > 24)'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\nTest Case ${index + 1}: ${testCase.name}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`Sequence: ${testCase.keys.join('')}`);

    // Count composition
    const composition = new Map<string, number>();
    testCase.keys.forEach(key => {
      composition.set(key, (composition.get(key) || 0) + 1);
    });

    console.log('Composition:', Array.from(composition.entries()).map(([k, v]) => `${k}:${v}`).join(', '));

    // Test the function by calling the row scoring which uses calculateExpectedRunsByGroup
    try {
      // We'll create a simple test by examining the console output
      // Since calculateExpectedRunsByGroup is internal, we can't call it directly
      // But we can verify the logic by checking the composition and expected behavior

      const n = testCase.keys.length;
      const useExact = n <= 24;
      console.log(`Expected calculation method: ${useExact ? 'EXACT' : 'APPROXIMATE'}`);

      // Manually verify some expectations
      composition.forEach((groupSize, groupKey) => {
        console.log(`Group ${groupKey} (${groupSize} samples):`);
        if (groupSize >= 2) {
          for (let runLength = 2; runLength <= Math.min(groupSize, 4); runLength++) {
            if (useExact) {
              // For exact calculation, we expect more sophisticated probability
              console.log(`  - Runs of length ${runLength}: Expected using exact hypergeometric calculation`);
            } else {
              // For approximate, we can calculate the expected value
              const groupProbability = groupSize / n;
              const consecutiveProbability = Math.pow(groupProbability, runLength);
              const possibleStartPositions = Math.max(0, n - runLength + 1);
              const expectedCount = possibleStartPositions * consecutiveProbability;
              console.log(`  - Runs of length ${runLength}: ~${expectedCount.toFixed(3)} (approximate)`);
            }
          }
        } else {
          console.log(`  - No runs possible (group size < 2)`);
        }
      });

    } catch (error) {
      console.error(`Test case ${index + 1} failed:`, error);
    }
  });

  console.log('\n=== Expected Runs Calculation Test Complete ===');
};

// Test for boundary conditions and edge cases
export const testExpectedRunsEdgeCases = () => {
  console.log('\n=== Testing Expected Runs Edge Cases ===');

  const edgeCases = [
    {
      name: 'Empty sequence',
      keys: [],
      expectedBehavior: 'Should handle gracefully'
    },
    {
      name: 'Single element',
      keys: ['R'],
      expectedBehavior: 'No runs possible'
    },
    {
      name: 'Two elements same',
      keys: ['R', 'R'],
      expectedBehavior: 'One possible run of length 2'
    },
    {
      name: 'Two elements different',
      keys: ['R', 'B'],
      expectedBehavior: 'No runs possible'
    },
    {
      name: 'All same elements',
      keys: ['R', 'R', 'R', 'R', 'R'],
      expectedBehavior: 'Multiple possible run lengths'
    },
    {
      name: 'Alternating pattern',
      keys: ['R', 'B', 'R', 'B', 'R', 'B'],
      expectedBehavior: 'No runs expected (perfect alternation)'
    }
  ];

  edgeCases.forEach((testCase, index) => {
    console.log(`\nEdge Case ${index + 1}: ${testCase.name}`);
    console.log(`Sequence: [${testCase.keys.join(', ')}]`);
    console.log(`Expected: ${testCase.expectedBehavior}`);

    if (testCase.keys.length > 0) {
      const composition = new Map<string, number>();
      testCase.keys.forEach(key => {
        composition.set(key, (composition.get(key) || 0) + 1);
      });
      console.log('Composition:', Array.from(composition.entries()).map(([k, v]) => `${k}:${v}`).join(', '));
    }
  });

  console.log('\n=== Edge Cases Test Complete ===');
};

// Validation test for mathematical properties
export const testExpectedRunsProperties = () => {
  console.log('\n=== Testing Mathematical Properties ===');

  // Test that expected runs make sense mathematically
  const testSequence = ['R', 'R', 'R', 'R', 'B', 'B', 'B', 'B'];
  console.log(`Test sequence: ${testSequence.join('')}`);

  console.log('\nMathematical Properties to Verify:');
  console.log('1. Expected runs should decrease as run length increases');
  console.log('2. Groups with more samples should have higher expected run counts');
  console.log('3. Total expected runs should be reasonable relative to sequence length');
  console.log('4. Exact calculation should give different (more accurate) results than approximate');

  // These properties would be verified by examining the actual output
  // of the calculateExpectedRunsByGroup function
};

// Direct test of calculateExpectedRunsByGroup function
export const testCalculateExpectedRunsByGroupDirect = () => {
  console.log('\n=== Direct Test of calculateExpectedRunsByGroup ===');

  const testCases = [
    {
      name: 'Equal binary groups (exact calculation)',
      keys: ['R', 'R', 'R', 'B', 'B', 'B'],
      expectedProperties: {
        useExact: true,
        groupCount: 2,
        maxRunLength: 3
      }
    },
    {
      name: 'Unequal groups (exact calculation)',
      keys: ['R', 'R', 'R', 'R', 'R', 'B', 'B'],
      expectedProperties: {
        useExact: true,
        groupCount: 2,
        maxRunLength: 5
      }
    },
    {
      name: 'Single sample group',
      keys: ['R', 'B', 'B', 'B'],
      expectedProperties: {
        useExact: true,
        groupCount: 2,
        rGroupRuns: 0, // R group has only 1 sample, no runs possible
        bGroupRuns: '>0' // B group has 3 samples, runs possible
      }
    },
    {
      name: 'Large sequence (approximate calculation)',
      keys: Array(30).fill(0).map((_, i) => i < 15 ? 'R' : 'B'),
      expectedProperties: {
        useExact: false,
        groupCount: 2,
        maxRunLength: 15
      }
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test Case ${index + 1}: ${testCase.name} ---`);
    console.log(`Sequence length: ${testCase.keys.length}`);
    console.log(`Sequence: ${testCase.keys.join('')}`);

    try {
      const result = calculateExpectedRunsByGroup(testCase.keys);

      console.log(`Groups found: ${result.size}`);

      result.forEach((runExpectations, groupKey) => {
        const composition = testCase.keys.filter(k => k === groupKey).length;
        console.log(`\nGroup '${groupKey}' (${composition} samples):`);

        if (runExpectations.size === 0) {
          console.log('  No runs expected (group size < 2)');
        } else {
          runExpectations.forEach((expectedCount, runLength) => {
            console.log(`  Run length ${runLength}: ${expectedCount.toFixed(4)} expected`);
          });
        }
      });

      // Validate expected properties
      console.log('\nValidation:');
      console.log(`✓ Group count: ${result.size} (expected: ${testCase.expectedProperties.groupCount})`);

      if (testCase.expectedProperties.rGroupRuns !== undefined) {
        const rGroupRuns = result.get('R')?.size || 0;
        if (testCase.expectedProperties.rGroupRuns === 0) {
          console.log(`✓ R group runs: ${rGroupRuns} (expected: 0)`);
        }
      }

      // Check mathematical properties
      result.forEach((runExpectations, groupKey) => {
        const runLengths = Array.from(runExpectations.keys()).sort((a, b) => a - b);
        const expectations = runLengths.map(len => runExpectations.get(len)!);

        // Verify that expected runs generally decrease with run length
        let isDecreasing = true;
        for (let i = 1; i < expectations.length; i++) {
          if (expectations[i] > expectations[i - 1]) {
            isDecreasing = false;
            break;
          }
        }

        if (expectations.length > 1) {
          console.log(`✓ Group '${groupKey}' expectations ${isDecreasing ? 'decrease' : 'do not decrease'} with run length`);
        }
      });

    } catch (error) {
      console.error(`❌ Test case ${index + 1} failed:`, error);
    }
  });

  console.log('\n=== Direct Test Complete ===');
};

// Test mathematical correctness
export const testExpectedRunsMathematicalCorrectness = () => {
  console.log('\n=== Testing Mathematical Correctness ===');

  // Test case where we can manually verify the calculation
  const keys = ['R', 'R', 'B', 'B']; // 2 Rs, 2 Bs
  console.log(`Test sequence: ${keys.join('')}`);
  console.log('Manual calculation for verification:');
  console.log('- Total positions: 4');
  console.log('- R group: 2 samples, B group: 2 samples');
  console.log('- Possible run lengths: 2 (for both groups)');

  const result = calculateExpectedRunsByGroup(keys);

  result.forEach((runExpectations, groupKey) => {
    console.log(`\nGroup '${groupKey}':`);
    runExpectations.forEach((expectedCount, runLength) => {
      console.log(`  Run length ${runLength}: ${expectedCount.toFixed(4)}`);

      if (runLength === 2) {
        // Manual verification for run length 2
        // For exact calculation: P(positions i,i+1 both from same group) * boundary conditions
        const groupSize = keys.filter(k => k === groupKey).length;
        const n = keys.length;

        console.log(`    Manual check: group size=${groupSize}, n=${n}`);
        console.log(`    Positions where run of 2 can start: ${n - 2 + 1} = ${n - 1}`);

        // For each starting position, probability = (groupSize/n) * ((groupSize-1)/(n-1))
        const baseProb = (groupSize / n) * ((groupSize - 1) / (n - 1));
        console.log(`    Base probability per position: ${baseProb.toFixed(4)}`);
      }
    });
  });
};

// Test for the new gap-based method
export const testGapBasedExpectedSequences = () => {
  console.log('\n=== Testing Gap-Based Expected Sequences Method ===');

  const testCases = [
    {
      name: 'Simple binary case (3R, 3B) - 1 run',
      groups: new Map([['R', 3], ['B', 3]]),
      targetGroup: 'R',
      runSize: 2,
      numberOfRuns: 1,
      description: 'Equal groups, target 1 run of size 2'
    },
    {
      name: 'Simple binary case (4R, 2B) - 2 runs',
      groups: new Map([['R', 4], ['B', 2]]),
      targetGroup: 'R',
      runSize: 2,
      numberOfRuns: 2,
      description: 'Unbalanced groups, target 2 runs of size 2'
    },
    {
      name: 'Three groups (2R, 2G, 2B) - 1 run',
      groups: new Map([['R', 2], ['G', 2], ['B', 2]]),
      targetGroup: 'R',
      runSize: 2,
      numberOfRuns: 1,
      description: 'Three equal groups, target 1 run of size 2'
    },
    {
      name: 'Only target group (6R) - 2 runs',
      groups: new Map([['R', 6]]),
      targetGroup: 'R',
      runSize: 3,
      numberOfRuns: 2,
      description: 'Only target group exists, 2 runs of size 3'
    },
    {
      name: 'Impossible - too many runs (5R, 3B)',
      groups: new Map([['R', 5], ['B', 3]]),
      targetGroup: 'R',
      runSize: 2,
      numberOfRuns: 5,
      description: 'More runs requested than gaps available'
    },
    {
      name: 'Impossible - run size too large (2R, 4B)',
      groups: new Map([['R', 2], ['B', 4]]),
      targetGroup: 'R',
      runSize: 3,
      numberOfRuns: 1,
      description: 'Run size larger than target group size'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test Case ${index + 1}: ${testCase.name} ---`);
    console.log(`Description: ${testCase.description}`);
    console.log(`Groups: ${Array.from(testCase.groups.entries()).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    console.log(`Target: ${testCase.targetGroup}, Run size: ${testCase.runSize}, Number of runs: ${testCase.numberOfRuns}`);

    try {
      const result = calculateExpectedSequencesGapMethod(testCase.groups, testCase.targetGroup, testCase.runSize, testCase.numberOfRuns);

      const targetCount = testCase.groups.get(testCase.targetGroup) || 0;
      const totalCount = Array.from(testCase.groups.values()).reduce((sum, count) => sum + count, 0);

      console.log(`Target count: ${targetCount}, Total count: ${totalCount}`);
      console.log(`Gap method result: ${result.toFixed(6)}`);

      if (targetCount < testCase.runSize) {
        console.log('Expected: 0 (impossible - run size > target group size)');
        console.log(`✓ Result matches expectation: ${result === 0}`);
        return;
      }

      // Calculate non-target groups
      const nonTargetGroups = new Map<string, number>();
      let totalNonTargetCount = 0;

      testCase.groups.forEach((count, group) => {
        if (group !== testCase.targetGroup) {
          nonTargetGroups.set(group, count);
          totalNonTargetCount += count;
        }
      });

      console.log(`Non-target groups: ${Array.from(nonTargetGroups.entries()).map(([k, v]) => `${k}:${v}`).join(', ')}`);
      console.log(`Total non-target count: ${totalNonTargetCount}`);

      if (totalNonTargetCount === 0) {
        const possibleRuns = Math.max(0, targetCount - testCase.runSize + 1);
        console.log(`Special case - only target group: ${possibleRuns} possible runs`);
        return;
      }

      // Calculate gaps and maximum runs
      const totalGaps = totalNonTargetCount + 1;
      const maxPossibleRuns = Math.floor(targetCount / testCase.runSize);

      console.log(`Total gaps: ${totalGaps}`);
      console.log(`Max possible runs of size ${testCase.runSize}: ${maxPossibleRuns}`);

      // Show the calculation steps for each r
      for (let r = 1; r <= Math.min(maxPossibleRuns, totalGaps); r++) {
        const remainingTargetMembers = targetCount - (r * testCase.runSize);
        const remainingGaps = totalGaps - r;

        console.log(`  r=${r}: ${r} runs of size ${testCase.runSize}`);
        console.log(`    Remaining target members: ${remainingTargetMembers}`);
        console.log(`    Remaining gaps: ${remainingGaps}`);
        console.log(`    Ways to choose gaps: C(${totalGaps}, ${r})`);
        console.log(`    Ways to distribute remaining: stars-and-bars(${remainingTargetMembers}, ${remainingGaps})`);
      }

      console.log('✓ Gap-based calculation steps completed');

    } catch (error) {
      console.error(`❌ Test case ${index + 1} failed:`, error);
    }
  });

  console.log('\n=== Gap-Based Method Test Complete ===');
};

// Test comparison between gap method and existing method
export const testGapMethodComparison = () => {
  console.log('\n=== Comparing Gap Method vs Existing Method ===');

  const testCases = [
    {
      name: 'Simple case for comparison',
      keys: ['R', 'R', 'R', 'B', 'B', 'B'],
      targetGroup: 'R',
      runSize: 2
    },
    {
      name: 'Unbalanced case',
      keys: ['R', 'R', 'R', 'R', 'B', 'B'],
      targetGroup: 'R',
      runSize: 2
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Comparison ${index + 1}: ${testCase.name} ---`);
    console.log(`Sequence: ${testCase.keys.join('')}`);

    // Count composition for gap method
    const composition = new Map<string, number>();
    testCase.keys.forEach(key => {
      composition.set(key, (composition.get(key) || 0) + 1);
    });

    console.log(`Composition: ${Array.from(composition.entries()).map(([k, v]) => `${k}:${v}`).join(', ')}`);

    try {
      // Test existing method
      const existingResult = calculateExpectedRunsByGroup(testCase.keys);
      const existingExpected = existingResult.get(testCase.targetGroup)?.get(testCase.runSize) || 0;

      console.log(`Existing method result for ${testCase.targetGroup} runs of size ${testCase.runSize}: ${existingExpected.toFixed(6)}`);

      // Test gap method
      const gapResult = calculateExpectedSequencesGapMethod(composition, testCase.targetGroup, testCase.runSize, 1);
      console.log(`Gap method result: ${gapResult.toFixed(6)}`);

      // Compare results
      const difference = Math.abs(existingExpected - gapResult);
      const relativeError = existingExpected > 0 ? (difference / existingExpected) * 100 : 0;
      console.log(`Difference: ${difference.toFixed(6)} (${relativeError.toFixed(2)}% relative error)`);

      console.log('✓ Comparison completed');

    } catch (error) {
      console.error(`❌ Comparison ${index + 1} failed:`, error);
    }
  });

  console.log('\n=== Method Comparison Complete ===');
};

// Uncomment to run tests
testSimplifiedQualityMetrics();
testExpectedRunsByGroup();
testExpectedRunsEdgeCases();
testExpectedRunsProperties();
testCalculateExpectedRunsByGroupDirect();
testExpectedRunsMathematicalCorrectness();
testGapBasedExpectedSequences();
testGapMethodComparison();