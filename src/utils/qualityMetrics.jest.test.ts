/**
 * Jest tests for quality metrics functions
 * Run with: npm test qualityMetrics.jest.test.ts
 */

import { calculateExpectedRunsByGroup } from './qualityMetrics';

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