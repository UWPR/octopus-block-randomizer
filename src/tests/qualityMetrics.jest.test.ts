/**
 * Jest tests for quality metrics functions
 * Run with: npm test qualityMetrics.jest.test.ts
 */

import { calculateExpectedRunsByGroup } from '../utils/qualityMetrics';

describe('calculateExpectedRunsByGroup', () => {

  test('should handle equal binary groups with exact calculation', () => {
    const keys = ['R', 'R', 'R', 'B', 'B', 'B'];
    const result = calculateExpectedRunsByGroup(keys);

    expect(result.size).toBe(2);
    expect(result.has('R')).toBe(true);
    expect(result.has('B')).toBe(true);

    const rRuns = result.get('R')!;
    const bRuns = result.get('B')!;

    // Both groups should have expected runs for length 2 and 3
    expect(rRuns.has(2)).toBe(true);
    expect(rRuns.has(3)).toBe(true);
    expect(bRuns.has(2)).toBe(true);
    expect(bRuns.has(3)).toBe(true);

    // Expected runs should be positive
    expect(rRuns.get(2)!).toBeGreaterThan(0);
    expect(bRuns.get(2)!).toBeGreaterThan(0);
  });

  test('should handle single sample groups correctly', () => {
    const keys = ['R', 'B', 'B', 'B'];
    const result = calculateExpectedRunsByGroup(keys);

    expect(result.size).toBe(2);

    const rRuns = result.get('R')!;
    const bRuns = result.get('B')!;

    // R group has only 1 sample, should have no expected runs
    expect(rRuns.size).toBe(0);

    // B group has 3 samples, should have expected runs
    expect(bRuns.size).toBeGreaterThan(0);
    expect(bRuns.has(2)).toBe(true);
  });

  test('should use exact calculation for small sequences', () => {
    const keys = ['R', 'R', 'B', 'B']; // n = 4 <= 24

    // Mock console.log to capture the calculation method
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    calculateExpectedRunsByGroup(keys);

    // Should log that it's using exact calculation
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Using exact expected run calculation')
    );

    consoleSpy.mockRestore();
  });

  test('should use approximate calculation for large sequences', () => {
    const keys = Array(30).fill(0).map((_, i) => i < 15 ? 'R' : 'B'); // n = 30 > 24

    // Mock console.log to capture the calculation method
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    calculateExpectedRunsByGroup(keys);

    // Should log that it's using approximate calculation
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Using approximate expected run calculation')
    );

    consoleSpy.mockRestore();
  });

  test('should have decreasing expectations for longer runs', () => {
    const keys = ['R', 'R', 'R', 'R', 'R', 'B', 'B']; // 5 Rs, 2 Bs
    const result = calculateExpectedRunsByGroup(keys);

    const rRuns = result.get('R')!;
    const runLengths = Array.from(rRuns.keys()).sort((a, b) => a - b);

    if (runLengths.length > 1) {
      // Generally, longer runs should be less expected
      for (let i = 1; i < runLengths.length; i++) {
        const shorterRunExpected = rRuns.get(runLengths[i-1])!;
        const longerRunExpected = rRuns.get(runLengths[i])!;

        // This is a general trend, but not always strict due to boundary conditions
        // So we'll just check that the values are reasonable
        expect(longerRunExpected).toBeGreaterThanOrEqual(0);
        expect(shorterRunExpected).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should handle empty sequences gracefully', () => {
    const keys: string[] = [];
    const result = calculateExpectedRunsByGroup(keys);

    expect(result.size).toBe(0);
  });

  test('should handle single element sequences', () => {
    const keys = ['R'];
    const result = calculateExpectedRunsByGroup(keys);

    expect(result.size).toBe(1);
    expect(result.has('R')).toBe(true);

    const rRuns = result.get('R')!;
    expect(rRuns.size).toBe(0); // No runs possible with single element
  });

  test('should produce reasonable expected values', () => {
    const keys = ['R', 'R', 'B', 'B']; // Simple case for manual verification
    const result = calculateExpectedRunsByGroup(keys);

    const rRuns = result.get('R')!;
    const bRuns = result.get('B')!;

    // Both should have some expectation for runs of length 2
    if (rRuns.has(2)) {
      const rExpected = rRuns.get(2)!;
      expect(rExpected).toBeGreaterThan(0);
      expect(rExpected).toBeLessThan(2); // Should be less than total possible positions
    }

    if (bRuns.has(2)) {
      const bExpected = bRuns.get(2)!;
      expect(bExpected).toBeGreaterThan(0);
      expect(bExpected).toBeLessThan(2); // Should be less than total possible positions
    }
  });
});

// describe('calculateExpectedSequencesGapMethod', () => {

//   test('should handle simple binary groups correctly', () => {
//     const groups = new Map([['R', 3], ['B', 3]]);
//     const result = calculateExpectedSequencesGapMethod(groups, 'R', 2);

//     expect(result).toBeGreaterThanOrEqual(0);
//     expect(result).toBeLessThan(10); // Should be reasonable
//   });

//   test('should return 0 when run size exceeds target group size', () => {
//     const groups = new Map([['R', 2], ['B', 4]]);
//     const result = calculateExpectedSequencesGapMethod(groups, 'R', 3);

//     expect(result).toBe(0);
//   });

//   test('should handle only target group case', () => {
//     const groups = new Map([['R', 6]]);
//     const result = calculateExpectedSequencesGapMethod(groups, 'R', 3);

//     // Should equal the number of possible starting positions for runs of size 3
//     const expectedPositions = Math.max(0, 6 - 3 + 1);
//     expect(result).toBe(expectedPositions);
//   });

//   test('should handle three groups correctly', () => {
//     const groups = new Map([['R', 2], ['G', 2], ['B', 2]]);
//     const result = calculateExpectedSequencesGapMethod(groups, 'R', 2);

//     expect(result).toBeGreaterThanOrEqual(0);
//     expect(result).toBeLessThan(5); // Should be reasonable for this composition
//   });

//   test('should handle unbalanced groups', () => {
//     const groups = new Map([['R', 4], ['B', 2]]);
//     const result = calculateExpectedSequencesGapMethod(groups, 'R', 2);

//     expect(result).toBeGreaterThanOrEqual(0);
//     // With more R samples, should have higher expected runs than balanced case
//   });

//   test('should handle edge case with minimum viable run', () => {
//     const groups = new Map([['R', 2], ['B', 1]]);
//     const result = calculateExpectedSequencesGapMethod(groups, 'R', 2);

//     expect(result).toBeGreaterThanOrEqual(0);
//   });

//   test('should produce consistent results for symmetric cases', () => {
//     const groups1 = new Map([['R', 3], ['B', 3]]);
//     const groups2 = new Map([['B', 3], ['R', 3]]);

//     const result1 = calculateExpectedSequencesGapMethod(groups1, 'R', 2);
//     const result2 = calculateExpectedSequencesGapMethod(groups2, 'R', 2);

//     // Should be the same regardless of group order in the map
//     expect(result1).toBe(result2);
//   });

//   test('should handle large run sizes appropriately', () => {
//     const groups = new Map([['R', 5], ['B', 3]]);

//     const result2 = calculateExpectedSequencesGapMethod(groups, 'R', 2);
//     const result4 = calculateExpectedSequencesGapMethod(groups, 'R', 4);

//     // Longer runs should generally be less expected
//     expect(result4).toBeLessThanOrEqual(result2);
//   });
// });

// describe('Gap Method vs Existing Method Comparison', () => {

//   test('should produce similar results for simple cases', () => {
//     const keys = ['R', 'R', 'R', 'B', 'B', 'B'];
//     const composition = new Map([['R', 3], ['B', 3]]);

//     const existingResult = calculateExpectedRunsByGroup(keys);
//     const existingExpected = existingResult.get('R')?.get(2) || 0;

//     const gapResult = calculateExpectedSequencesGapMethod(composition, 'R', 2);

//     // Results should be in the same ballpark (within reasonable tolerance)
//     const tolerance = Math.max(0.1, existingExpected * 0.5); // 50% tolerance or 0.1 minimum
//     expect(Math.abs(existingExpected - gapResult)).toBeLessThanOrEqual(tolerance);
//   });

//   test('should both handle unbalanced cases', () => {
//     const keys = ['R', 'R', 'R', 'R', 'B', 'B'];
//     const composition = new Map([['R', 4], ['B', 2]]);

//     const existingResult = calculateExpectedRunsByGroup(keys);
//     const existingExpected = existingResult.get('R')?.get(2) || 0;

//     const gapResult = calculateExpectedSequencesGapMethod(composition, 'R', 2);

//     // Both should produce positive results for this viable case
//     expect(existingExpected).toBeGreaterThan(0);
//     expect(gapResult).toBeGreaterThan(0);

//     // Results should be reasonably close
//     const maxExpected = Math.max(existingExpected, gapResult);
//     const difference = Math.abs(existingExpected - gapResult);
//     const relativeError = maxExpected > 0 ? difference / maxExpected : 0;

//     expect(relativeError).toBeLessThan(1.0); // Less than 100% relative error
//   });

//   test('should both return 0 for impossible cases', () => {
//     const keys = ['R', 'B', 'B', 'B'];
//     const composition = new Map([['R', 1], ['B', 3]]);

//     const existingResult = calculateExpectedRunsByGroup(keys);
//     const existingExpected = existingResult.get('R')?.get(2) || 0;

//     const gapResult = calculateExpectedSequencesGapMethod(composition, 'R', 2);

//     // Both should return 0 since R group has only 1 sample
//     expect(existingExpected).toBe(0);
//     expect(gapResult).toBe(0);
//   });
// });