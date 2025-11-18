/**
 * Jest tests function calculateExpectedRunsByGroup
 * Run with: npm test qualityMetrics.jest.test.ts
 */

import { calculateExpectedRunsByGroupForTest } from '../utils/qualityMetrics';

describe('Tests for calculateExpectedRunsByGroup', () => {

     describe('Edge Cases', () => {

         test('Should handle empty sequences gracefully', () => {
            const keys: string[] = [];
            const result = calculateExpectedRunsByGroupForTest(keys);

            expect(result.size).toBe(0);
        });

        test('Should handle single element sequences', () => {
            const keys = ['R'];
            const result = calculateExpectedRunsByGroupForTest(keys);

            expect(result.size).toBe(0); // No runs possible with single element
        });

    });

    describe('Two Groups', () => {

        test('Should handle groups with single elements correctly', () => {
            const keys = ['R', 'B', 'B', 'B'];
            const result = calculateExpectedRunsByGroupForTest(keys);

            expect(result.size).toBe(2);

            const rRuns = result.get('R')!;
            const bRuns = result.get('B')!;

            // R group has only 1 sample, should have no expected runs
            expect(rRuns.size).toBe(1);
            expect(rRuns.has(1)).toBe(true); // Only one R, so one run of length 1;
            expect(rRuns.get(1)).toBe(0); // Expected runs of length 1 is 0

            // B group has 3 samples, should have <= 1 expected runs of length 3
            expect(bRuns.size).toBe(1);
            expect(bRuns.has(3)).toBe(true); // Run of length 3
            expect(bRuns.get(3)).toBeLessThan(1); // Max 1 run expected of length 3
        });

        test('Should have smaller expected # of runs for longer runs', () => {
            const keys = ['R', 'R', 'B', 'R', 'R', 'R', 'R', 'B', 'B']; // 6 R's and 3 B's
            const result = calculateExpectedRunsByGroupForTest(keys);

            const rRuns = result.get('R')!;
            const bRuns = result.get('B')!;

            // R group has 6 samples, with runs of length 2 and 4.
            expect(rRuns.size).toBe(2);
            expect(rRuns.has(2)).toBe(true); // Run of length 2;
            expect(rRuns.has(4)).toBe(true); // Run of length 4;
            const expectedRunsLength2 = rRuns.get(2)!;
            const expectedRunsLength4 = rRuns.get(4)!;
            expect(expectedRunsLength4).toBeLessThanOrEqual(1) // Max 1 run expected of length 4
            expect(expectedRunsLength2).toBeLessThanOrEqual(3); // Max 3 expected runs of length 2
            expect(expectedRunsLength2).toBeGreaterThan(expectedRunsLength4); // More expected runs of length 2 than 4

            // B group has 3 samples, with runs of length 1 and 2
            expect(bRuns.size).toBe(2);
            expect(bRuns.has(1)).toBe(true); // Run of length 1
            expect(bRuns.has(2)).toBe(true); // Run of length 2
            const expectedBRunsLength1 = bRuns.get(1)!;
            const expectedBRunsLength2 = bRuns.get(2)!;
            expect(expectedBRunsLength2).toBeLessThanOrEqual(1); // Max 1 run expected of length 2
            expect(expectedBRunsLength1).toBe(0); // We don't look at runs of length < 2
            expect(expectedBRunsLength2).toBeGreaterThan(expectedBRunsLength1);
        });
    });
});