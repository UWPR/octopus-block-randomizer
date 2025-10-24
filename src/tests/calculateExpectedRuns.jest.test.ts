/**
 * Tests for calculateExpectedRuns function
 * Tests the combinatorial gap analysis method for calculating expected runs
 * Run with: npm test calculateExpectedRuns.jest.test.ts
 */

import { calculateExpectedRuns, calculateMultinomialCoefficient } from '../utils/qualityMetrics';

describe('Tests for calculateExpectedRun', () => {
  
  describe('Edge Cases', () => {
    
     test('Should return 0 when groupSize < runLength', () => {
       const composition = new Map([['R', 2], ['B', 3]]);
       const result = calculateExpectedRuns(composition, 'R', 3, 10);
       expect(result).toBe(0);
     });

    test('Should return 0 when runLength < 2', () => {
      const composition = new Map([['R', 3], ['B', 2]]);
      const result = calculateExpectedRuns(composition, 'R', 1, 10);
      expect(result).toBe(0);
    });

    test('Should return 0 when runLength = 0', () => {
      const composition = new Map([['R', 3], ['B', 2]]);
      const result = calculateExpectedRuns(composition, 'R', 0, 10);
      expect(result).toBe(0);
    });

    test('Should handle negative runLength', () => {
      const composition = new Map([['R', 3], ['B', 2]]);
      const result = calculateExpectedRuns(composition, 'R', -1, 10);
      expect(result).toBe(0);
    });

    test('Should handle empty composition', () => {
      const composition = new Map();
      const result = calculateExpectedRuns(composition, 'R', 2, 1);
      expect(result).toBe(0);
    });

    test('Should handle target group not in composition', () => {
      const composition = new Map([['B', 3], ['G', 2]]);
      const result = calculateExpectedRuns(composition, 'R', 2, 10);
      expect(result).toBe(0);
    });
  });

  describe('Single Group Cases', () => {
    
    test('Should handle all samples from target group (no non-target groups)', () => {
      const composition = new Map([['R', 5]]);
      const result = calculateExpectedRuns(composition, 'R', 2, 1);
      // Should equal the number of possible starting positions for runs of size 2
      // Expected runs = n - runLength + 1
      const expectedRuns = 5 - 2 + 1; // n - runLength + 1
      expect(result).toBe(expectedRuns);
    });

    test('Should handle all samples from target group with runLength = groupSize', () => {
      const composition = new Map([['R', 4]]);
      const result = calculateExpectedRuns(composition, 'R', 4, 1);
      // Expected runs = n - runLength + 1 = 4 - 4 + 1 = 1
      expect(result).toBe(1);
    });
  });

  describe('Two Groups', () => {
    
    test('Should calculate expected runs for two groups of equal size', () => {
      const composition = new Map([['R', 3], ['B', 3]]);
      const totalArrangements = 20; // 6!/(3!*3!) = 20
      const result = calculateExpectedRuns(composition, 'R', 2, totalArrangements);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1); // Maximum 1 run of length 2 from 3 'R' samples
    });

    test('Should calculate calculate for runLength = groupSize', () => {
      const composition = new Map([['R', 2], ['B', 4]]);
      const totalArrangements = 15; // 6!/(2!*4!) = 15
      const result = calculateExpectedRuns(composition, 'R', 2, totalArrangements);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1); // Maximum 1 run of length 2
    });

    test('Should handle target group smaller than runLength', () => {
      const composition = new Map([['R', 1], ['B', 4]]);
      const totalArrangements = 5; // 5!/(1!*4!) = 5
      const result = calculateExpectedRuns(composition, 'R', 2, totalArrangements);
      expect(result).toBe(0);
    });

    test('Should handle large run sizes appropriately', () => {
    const groups = new Map([['R', 5], ['B', 3]]);
    const totalArrangements = calculateMultinomialCoefficient(8, [5, 3]); // 8!/(5!*3!) = 56
    const result1 = calculateExpectedRuns(groups, 'R', 2, totalArrangements);
    const result2 = calculateExpectedRuns(groups, 'R', 4, totalArrangements);
    // Longer runs should generally be less expected
    expect(result2).toBeLessThanOrEqual(result1);
  });
  
  });

  describe('Multiple Groups', () => {
    
    test('should handle three groups with target group', () => {
      const composition = new Map([['R', 2], ['B', 2], ['G', 2]]);
      const totalArrangements = calculateMultinomialCoefficient(6, [2, 2, 2]); // 6!/(2!*2!*2!) = 90
      const result = calculateExpectedRuns(composition, 'R', 2, totalArrangements);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1); // Maximum 1 run of length 2
    });

    test('Should handle four groups with different sizes', () => {
      const composition = new Map([['R', 3], ['B', 2], ['G', 1], ['Y', 1]]);
      const totalArrangements = calculateMultinomialCoefficient(7, [3, 2, 1, 1]); // 7!/(3!*2!*1!*1!) = 420
      const result = calculateExpectedRuns(composition, 'R', 2, totalArrangements);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1); // Maximum 1 run of length 2
    });

    test('Should handle target group with multiple possible run lengths', () => {
      const composition = new Map([['R', 4], ['B', 2], ['G', 1]]);
      const totalArrangements = calculateMultinomialCoefficient(7, [4, 2, 1]); // 7!/(4!*2!*1!) = 105
      const result = calculateExpectedRuns(composition, 'R', 3, totalArrangements);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1); // Maximum 1 run of length 3 from 4 'R' samples

      const runLength = 2;
      const maxRuns = Math.floor(4 / runLength); // Maximum runs of length 2
      const result2 = calculateExpectedRuns(composition, 'R', 2, totalArrangements);
      expect(result2).toBeGreaterThan(0);
      expect(result2).toBeLessThanOrEqual(maxRuns); // Maximum 2 runs of length 2 from 4 'R' samples
    });
  });

  describe('Impossible Test Cases', () => {
    
    test('Should handle the impossible case from existing tests', () => {
      // Impossible - run size too large (2R, 4B)
      const composition = new Map([['R', 2], ['B', 4]]);
      const result = calculateExpectedRuns(composition, 'R', 3, 15);
    
      // Should return 0 since runLength (3) > groupSize (2)
      expect(result).toBe(0);
    });

  });

  describe('Large Cases', () => {
    
    test('Should handle moderately large sequences', () => {
      const composition = new Map([['R', 10], ['B', 10], ['G', 5]]);
      const totalArrangements = calculateMultinomialCoefficient(25, [10, 10, 5]); // 25!/(10!*10!*5!) = 9,816,086,280
      const result = calculateExpectedRuns(composition, 'R', 3, totalArrangements);
      
      expect(result).toBeGreaterThan(0);
      // Maximum possible runs of length 3 from 10 'R' samples = floor(10/3) = 3
      const maxPossibleRuns = Math.floor(10 / 3);
      expect(result).toBeLessThanOrEqual(maxPossibleRuns);
    });
  });

  describe('Boundary Conditions', () => {
    
    test('Should handle when remaining target members = 0', () => {
      const composition = new Map([['R', 4], ['B', 2]]);
      const totalArrangements = calculateMultinomialCoefficient(6, [4, 2]); // 6!/(4!*2!) = 15
      const result = calculateExpectedRuns(composition, 'R', 4, totalArrangements);
      
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });
});
