/**
 * Tests for assignBlockCapacities function from balancedRandomization.ts
 * Tests the capacity assignment logic for both plates and rows
 */

import { assignBlockCapacities } from '../algorithms/balancedRandomization';
import { BlockType } from '../utils/types';

describe('assignBlockCapacities', () => {

    describe('Plates - keepEmptyInLastBlock = true (sequential filling)', () => {

        test('Should fill plates sequentially when samples perfectly divide by plate size', () => {
            // 96 samples, 48 plate size, 2 plates needed
            const result = assignBlockCapacities(96, 48, true, 2, BlockType.PLATE);

            expect(result).toEqual([48, 48]);
            expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(96);
        });

        test('Should put remainder in last plate when samples do not perfectly divide', () => {
            // 100 samples, 48 plate size, 3 plates needed (48 + 48 + 4) - 2 full and one partial
            const result = assignBlockCapacities(100, 48, true, 3, BlockType.PLATE);

            expect(result).toEqual([48, 48, 4]);
            expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(100);
        });

        test('Should handle single plate with partial capacity', () => {
            // 30 samples, 96 plate size, 1 plate needed
            const result = assignBlockCapacities(30, 96, true, 1, BlockType.PLATE);

            expect(result).toEqual([30]);
            expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(30);
        });
    });

    describe('Plates - keepEmptyInLastBlock = false (random distribution of extra samples)', () => {

        test('Should distribute samples across all available blocks', () => {
            // 96 samples, 96 plate size, max 2 plates available
            // With keepEmptyInLastBlock=false, should use all available plates to spread samples
            const result = assignBlockCapacities(96, 96, false, 2, BlockType.PLATE);

            expect(result).toHaveLength(2);
            expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(96);
            expect(result).toEqual([48, 48]);
        });

        test('Should produce different distributions across multiple runs', () => {
            // Run the same configuration multiple times to check for randomization
            // 98 samples, 4 blocks should sometimes produce different orderings
            const results = [];
            for (let i = 0; i < 10; i++) {
                const result = assignBlockCapacities(98, 96, false, 4, BlockType.PLATE);
                results.push(result.join(','));

                expect(result).toHaveLength(4);
                expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(98);

                // Should have base of 24 with 2 extra samples distributed
                const sortedResult = result.sort((a, b) => a - b);
                expect(sortedResult).toEqual([24, 24, 25, 25]);
            }

            // Should have at least some variation in results (not all identical)
            const uniqueResults = new Set(results);
            expect(uniqueResults.size).toBeGreaterThan(1);
        });
    });

    describe('Rows - keepEmptyInLastBlock = true (sequential filling)', () => {

        test('Should fill rows sequentially when samples perfectly divide by row size', () => {
            // 24 samples, 12 columns per row, max 8 rows available
            const result = assignBlockCapacities(24, 12, true, 8, BlockType.ROW);

            expect(result).toEqual([12, 12]);
            expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(24);
        });

        test('Should put remainder in last row when samples do not perfectly divide', () => {
            // 30 samples, 12 columns per row, max 8 rows available
            const result = assignBlockCapacities(30, 12, true, 8, BlockType.ROW);

            expect(result).toEqual([12, 12, 6]);
            expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(30);
        });
    });

    describe('Rows - keepEmptyInLastBlock = false (random distribution of extra samples)', () => {

        test('Should produce different distributions across multiple runs', () => {
            // Run the same configuration multiple times to check for randomization
            // 25 samples, 3 rows, base: 8 each, extra: 1 sample
            const results = [];
            for (let i = 0; i < 10; i++) {
                const result = assignBlockCapacities(25, 12, false, 3, BlockType.ROW);
                results.push(result.join(','));

                expect(result).toHaveLength(3);
                expect(result.reduce((sum, cap) => sum + cap, 0)).toBe(25);

                // Should have two rows with 8 and one row with 9
                const sortedResult = result.sort((a, b) => a - b);
                expect(sortedResult).toEqual([8, 8, 9]);
            }

            // Should have at least some variation in results (not all identical)
            const uniqueResults = new Set(results);
            expect(uniqueResults.size).toBeGreaterThan(1);
        });
    });

    describe('Edge cases', () => {

        test('Should handle zero samples', () => {
            const result = assignBlockCapacities(0, 96, true, 1, BlockType.PLATE);

            expect(result).toEqual([0]);
        });

        test('Should handle very small sample counts', () => {
            const result = assignBlockCapacities(1, 96, true, 1, BlockType.PLATE);

            expect(result).toEqual([1]);
        });

        test('Should handle when plates are insufficient to fit all samples (keepEmpty=true)', () => {
            // 200 samples, 96 plate size, but only 1 plate given - should exceed total plate capacity
            const result = assignBlockCapacities(200, 96, true, 1, BlockType.PLATE);

            // 200 samples needs Math.floor(200/96) = 2 full plates + 8 remaining
            // But only 1 plate is provided. This will log an error and return [0]
            expect(result).toEqual([0]);
        });

        test('Should handle when plates are insufficient to fit all samples (keepEmpty=false)', () => {
            // 200 samples, but only 1 plate given - should exceed total plate capacity
            const result = assignBlockCapacities(200, 96, false, 1, BlockType.PLATE);

            // Only 1 plate is provided. This will log an error and return [0]
            expect(result).toEqual([0]);
        });

        test('Should handle when rows are insufficient to fit all samples (keepEmpty=true)', () => {
            // 50 samples, 12 columns per row, but only 2 rows given
            // Should need Math.ceil(50/12) = 5 rows, but only 2 provided
            const result = assignBlockCapacities(50, 12, true, 2, BlockType.ROW);

            // Should log error and return [0]
            expect(result).toEqual([0]);
        });

        test('Should handle when rows are insufficient to fit all samples (keepEmpty=false)', () => {
            // 50 samples, 12 columns per row, but only 2 rows given
            // Should need Math.ceil(50/12) = 5 rows, but only 2 provided
            const result = assignBlockCapacities(50, 12, false, 2, BlockType.ROW);

            // Should log error and return [0]
            expect(result).toEqual([0]);
        });
    });
});