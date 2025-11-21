import {
  calculateClusterScore,
  greedyPlaceInRow,
  analyzePlateSpatialQuality,
  analyzeOverallSpatialQuality
} from '../algorithms/greedySpatialPlacement';
import { SearchData } from '../utils/types';

describe('Greedy Spatial Placement', () => {
  const createSample = (id: string, gender: string, protocol: string, treatment: string): SearchData => ({
    name: `Sample_${id}`,
    metadata: {
      gender: gender,
      protocol,
      treatment
    },
    treatmentKey: `${gender}|${protocol}|${treatment}`
  });

  describe('calculateClusterScore', () => {
    it('should return 0 for first placement in empty plate', () => {
      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];

      const score = calculateClusterScore(plates[0], 0, 0, 'Male|P1|Control', 12);

      expect(score).toBe(0);
    });

    it('should penalize horizontal adjacency heavily', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];
      plates[0][0][0] = sample1;

      const treatmentKey = 'Male|P1|Control';

      // Check position 1 (right next to position 0)
      const score = calculateClusterScore(plates[0], 0, 1, treatmentKey, 12);

      expect(score).toBe(10); // Heavy penalty for horizontal adjacency
    });

    it('should penalize vertical adjacency heavily', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];
      plates[0][0][0] = sample1;

      const treatmentKey = 'Male|P1|Control';

      // Check position in row 1, column 0 (directly below)
      const score = calculateClusterScore(plates[0], 1, 0, treatmentKey, 12);

      expect(score).toBe(10); // Heavy penalty for vertical adjacency
    });

    it('should penalize cross-row adjacency', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];
      // Place sample at last column of row 0
      plates[0][0][11] = sample1;

      const treatmentKey = 'Male|P1|Control';

      // Check first column of row 1 (cross-row position)
      const score = calculateClusterScore(plates[0], 1, 0, treatmentKey, 12);

      expect(score).toBe(8); // Medium-high penalty for cross-row adjacency
    });

    it('should not penalize different treatment groups', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];
      plates[0][0][0] = sample1;

      const differentTreatmentKey = 'Female|P2|Treatment';

      // Check position 1 (right next to position 0, but different treatment)
      const score = calculateClusterScore(plates[0], 0, 1, differentTreatmentKey, 12);

      expect(score).toBe(0); // No penalty for different treatment
    });
  });

  describe('greedyPlaceInRow', () => {
    it('should minimize horizontal adjacency when possible', () => {
      const samples = [
        createSample('1', 'Male', 'P1', 'Control'),
        createSample('2', 'Male', 'P1', 'Control'),
        createSample('3', 'Female', 'P2', 'Treatment'),
        createSample('4', 'Male', 'P3', 'Blinded'),
        createSample('5', 'Female', 'P4', 'XRay')
      ];

      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];

      greedyPlaceInRow(samples, plates[0], 0, 12);

      // Check that the two Male|P1|Control samples are not adjacent
      let adjacentCount = 0;
      for (let col = 0; col < 11; col++) {
        const current = plates[0][0][col];
        const next = plates[0][0][col + 1];
        if (current && next && current.treatmentKey === next.treatmentKey) {
          adjacentCount++;
        }
      }

      expect(adjacentCount).toBe(0); // No adjacent same-treatment samples
    });

    it('should place all samples in the row', () => {
      const samples = [
        createSample('1', 'Male', 'P1', 'Control'),
        createSample('2', 'Female', 'P2', 'Treatment'),
        createSample('3', 'Male', 'P3', 'Blinded')
      ];

      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];

      greedyPlaceInRow(samples, plates[0], 0, 12);

      // Count placed samples
      const placedCount = plates[0][0].filter(s => s !== undefined).length;

      expect(placedCount).toBe(3);
    });
  });

  describe('analyzePlateSpatialQuality', () => {
    it('should detect horizontal clusters', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const sample2 = createSample('2', 'Male', 'P1', 'Control');

      const plate: (SearchData | undefined)[][] = Array.from({ length: 8 }, () =>
        new Array(12).fill(undefined)
      );
      plate[0][0] = sample1;
      plate[0][1] = sample2;

      const quality = analyzePlateSpatialQuality(plate, 8, 12);

      expect(quality.horizontalClusters).toBe(1);
      expect(quality.verticalClusters).toBe(0);
      expect(quality.crossRowClusters).toBe(0);
    });

    it('should detect vertical clusters', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const sample2 = createSample('2', 'Male', 'P1', 'Control');

      const plate: (SearchData | undefined)[][] = Array.from({ length: 8 }, () =>
        new Array(12).fill(undefined)
      );
      plate[0][0] = sample1;
      plate[1][0] = sample2;

      const quality = analyzePlateSpatialQuality(plate, 8, 12);

      expect(quality.horizontalClusters).toBe(0);
      expect(quality.verticalClusters).toBe(1);
      expect(quality.crossRowClusters).toBe(0);
    });

    it('should detect cross-row clusters', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const sample2 = createSample('2', 'Male', 'P1', 'Control');

      const plate: (SearchData | undefined)[][] = Array.from({ length: 8 }, () =>
        new Array(12).fill(undefined)
      );
      plate[0][11] = sample1; // Last column of row 0
      plate[1][0] = sample2; // First column of row 1

      const quality = analyzePlateSpatialQuality(plate, 8, 12);

      expect(quality.horizontalClusters).toBe(0);
      expect(quality.verticalClusters).toBe(0);
      expect(quality.crossRowClusters).toBe(1);
    });

    it('should return zero clusters for well-distributed samples', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const sample2 = createSample('2', 'Male', 'P1', 'Control');
      const sample3 = createSample('3', 'Female', 'P2', 'Treatment');

      const plate: (SearchData | undefined)[][] = Array.from({ length: 8 }, () =>
        new Array(12).fill(undefined)
      );
      // Place samples far apart
      plate[0][0] = sample1;
      plate[0][5] = sample2;
      plate[0][2] = sample3;

      const quality = analyzePlateSpatialQuality(plate, 8, 12);

      expect(quality.totalClusters).toBe(0);
    });
  });

  describe('analyzeOverallSpatialQuality', () => {
    it('should aggregate quality across multiple plates', () => {
      const sample1 = createSample('1', 'Male', 'P1', 'Control');
      const sample2 = createSample('2', 'Male', 'P1', 'Control');
      const sample3 = createSample('3', 'Female', 'P2', 'Treatment');
      const sample4 = createSample('4', 'Female', 'P2', 'Treatment');

      const plates: (SearchData | undefined)[][][] = [
        Array.from({ length: 8 }, () => new Array(12).fill(undefined)),
        Array.from({ length: 8 }, () => new Array(12).fill(undefined))
      ];

      // Plate 0: 1 horizontal cluster
      plates[0][0][0] = sample1;
      plates[0][0][1] = sample2;

      // Plate 1: 1 vertical cluster
      plates[1][0][0] = sample3;
      plates[1][1][0] = sample4;

      const quality = analyzeOverallSpatialQuality(plates, 8, 12);

      expect(quality.plateQualities).toHaveLength(2);
      expect(quality.plateQualities[0].plateIndex).toBe(0);
      expect(quality.plateQualities[0].horizontalClusters).toBe(1);
      expect(quality.plateQualities[0].verticalClusters).toBe(0);
      expect(quality.plateQualities[1].plateIndex).toBe(1);
      expect(quality.plateQualities[1].horizontalClusters).toBe(0);
      expect(quality.plateQualities[1].verticalClusters).toBe(1);
      expect(quality.totalHorizontalClusters).toBe(1);
      expect(quality.totalVerticalClusters).toBe(1);
      expect(quality.totalClusters).toBe(2);
    });
  });
});
