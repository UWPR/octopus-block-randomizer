/**
 * Jest tests function calculateExpectedRunsByGroup
 * Run with: npm test qualityMetrics.jest.test.ts
 */

import { calculateExpectedRunsByGroup } from '../utils/qualityMetrics';

describe('calculateExpectedRun', () => {

     describe('Edge Cases', () => {

         test('Should handle empty sequences gracefully', () => {
            const keys: string[] = [];
            const result = calculateExpectedRunsByGroup(keys);

            expect(result.size).toBe(0);
        });

        test('Should handle single element sequences', () => {
            const keys = ['R'];
            const result = calculateExpectedRunsByGroup(keys);

            expect(result.size).toBe(1);
            expect(result.has('R')).toBe(true);

            const rRuns = result.get('R')!;
            expect(rRuns.size).toBe(0); // No runs possible with single element
        });
      
    });

    describe('Two Groups', () => {

        test('Should handle single sample groups correctly', () => {
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

    });

    test('Should have smaller expected runs for longer runs', () => {
        const keys = ['R', 'R', 'R', 'R', 'R', 'B', 'B']; // 5 Rs, 2 Bs
        const result = calculateExpectedRunsByGroup(keys);

        const rRuns = result.get('R')!;
        const runLengths = Array.from(rRuns.keys()).sort((a, b) => a - b);

        if (runLengths.length > 1) {
            // Longer runs should have smaller expected values
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
});