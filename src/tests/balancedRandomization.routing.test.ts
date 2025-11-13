import { balancedBlockRandomization } from '../algorithms/balancedRandomization';
import { SearchData, RandomizationConfig } from '../utils/types';

describe('balancedBlockRandomization routing', () => {
  const mockSamples: SearchData[] = [
    { name: 'Sample1', metadata: { Treatment: 'Drug', PatientID: 'P001' } },
    { name: 'Sample2', metadata: { Treatment: 'Placebo', PatientID: 'P001' } },
    { name: 'Sample3', metadata: { Treatment: 'Drug', PatientID: 'P002' } },
    { name: 'Sample4', metadata: { Treatment: 'Placebo', PatientID: 'P002' } },
  ];

  describe('backward compatibility', () => {
    it('should work with legacy signature (array of covariates)', () => {
      const result = balancedBlockRandomization(
        mockSamples,
        ['Treatment'],
        true,
        8,
        12
      );

      expect(result).toBeDefined();
      expect(result.plates).toBeDefined();
      expect(Array.isArray(result.plates)).toBe(true);
    });
  });

  describe('new config-based signature', () => {
    it('should route to standard randomization when no repeated-measures variable', () => {
      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12,
      };

      const result = balancedBlockRandomization(mockSamples, config);

      expect(result).toBeDefined();
      expect(result.plates).toBeDefined();
      expect(Array.isArray(result.plates)).toBe(true);
    });

    it('should route to repeated-measures-aware randomization when repeated-measures variable is set', () => {
      const config: RandomizationConfig = {
        treatmentVariables: ['Treatment'],
        repeatedMeasuresVariable: 'PatientID',
        keepEmptyInLastPlate: true,
        numRows: 8,
        numColumns: 12,
      };

      const result = balancedBlockRandomization(mockSamples, config);

      expect(result).toBeDefined();
      expect(result.plates).toBeDefined();
      expect(Array.isArray(result.plates)).toBe(true);
      expect(result.repeatedMeasuresGroups).toBeDefined();
      expect(result.repeatedMeasuresGroups?.length).toBe(2); // P001 and P002

      // Verify quality metrics are returned
      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics?.repeatedMeasuresConstraintsSatisfied).toBe(true);
      expect(result.qualityMetrics?.repeatedMeasuresViolations).toBe(0);
      expect(result.qualityMetrics?.treatmentBalanceScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics?.treatmentBalanceScore).toBeLessThanOrEqual(100);
      expect(result.qualityMetrics?.plateGroupCounts).toBeDefined();
      expect(result.qualityMetrics?.groupSizeDistribution).toBeDefined();
      expect(result.qualityMetrics?.standardMetrics).toBeDefined();
    });
  });
});
