import { useState, useCallback, useMemo } from 'react';
import { SearchData, QualityMetrics } from '../types';
import { calculateQualityMetrics } from '../utils/qualityMetrics';

/**
 * Custom hook for managing quality metrics calculation and state
 *
 * Provides:
 * - Quality metrics calculation
 * - Caching and memoization
 * - Loading states
 * - Error handling
 */
export function useQualityMetrics() {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [showMetrics, setShowMetrics] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate quality metrics for the current randomization
   */
  const calculateMetrics = useCallback(async (
    searches: SearchData[],
    randomizedPlates: (SearchData | undefined)[][][],
    plateAssignments: Map<number, SearchData[]> | undefined,
    selectedCovariates: string[],
    plateRows: number,
    plateColumns: number
  ) => {
    if (!searches.length || !selectedCovariates.length || !plateAssignments || !plateAssignments.size) {
      setMetrics(null);
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const qualityMetrics = calculateQualityMetrics(
        searches,
        plateAssignments,
        selectedCovariates
      );

      setMetrics(qualityMetrics);
      setIsCalculating(false);
    } catch (err) {
      console.error('Error calculating quality metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate quality metrics');
      setIsCalculating(false);
    }
  }, []);

  /**
   * Reset metrics state
   */
  const resetMetrics = useCallback(() => {
    setMetrics(null);
    setError(null);
    setIsCalculating(false);
  }, []);

  /**
   * Toggle metrics panel visibility
   */
  const toggleMetrics = useCallback(() => {
    setShowMetrics(prev => !prev);
  }, []);

  /**
   * Get quality summary for display in other components
   */
  const qualitySummary = useMemo(() => {
    if (!metrics) return null;

    return {
      overallScore: metrics.overallQuality.score,
      qualityLevel: metrics.overallQuality.level,
      hasIssues: metrics.overallQuality.recommendations.some(rec =>
        rec.includes('re-randomization') ||
        rec.includes('poor balance') ||
        rec.includes('Low plate')
      ),
      criticalIssues: metrics.overallQuality.recommendations.filter(rec =>
        rec.includes('re-randomization') || rec.includes('systematic imbalance')
      ).length,
      totalRecommendations: metrics.overallQuality.recommendations.length
    };
  }, [metrics]);

  /**
   * Get covariate-specific quality indicators
   */
  const covariateQuality = useMemo(() => {
    if (!metrics) return {};

    const quality: { [covariate: string]: { score: number; status: 'good' | 'warning' | 'poor' } } = {};

    Object.entries(metrics.covariateGroups).forEach(([combination, metric]) => {
      let status: 'good' | 'warning' | 'poor';
      if (metric.adjustedAssessment === 'good') status = 'good';
      else if (metric.adjustedAssessment === 'acceptable') status = 'warning';
      else status = 'poor';

      // Convert CV to a 0-100 score for compatibility
      const score = Math.max(0, 100 - metric.cv);

      quality[combination] = {
        score,
        status
      };
    });

    return quality;
  }, [metrics]);

  /**
   * Check if re-randomization is recommended
   */
  const shouldReRandomize = useMemo(() => {
    if (!metrics) return false;

    return metrics.overallQuality.score < 60 ||
      metrics.overallQuality.recommendations.some(rec => rec.includes('re-randomization'));
  }, [metrics]);

  /**
   * Get performance insights
   */
  const performanceInsights = useMemo(() => {
    if (!metrics) return null;

    const insights = {
      bestCovariates: [] as string[],
      worstCovariates: [] as string[],
      plateRepresentativeness: metrics.plateDiversity.averageProportionalAccuracy,
      plateDiversityScore: metrics.plateDiversity.averageEntropy,
      balanceConsistency: metrics.overallQuality.score
    };

    // Find best and worst performing covariate groups
    const covariateEntries = Object.entries(metrics.covariateGroups)
      .sort((a, b) => {
        const scoreA = a[1].adjustedAssessment === 'good' ? 100 : a[1].adjustedAssessment === 'acceptable' ? 75 : 25;
        const scoreB = b[1].adjustedAssessment === 'good' ? 100 : b[1].adjustedAssessment === 'acceptable' ? 75 : 25;
        return scoreB - scoreA;
      });

    insights.bestCovariates = covariateEntries.slice(0, 2).map(([name]) => name);
    insights.worstCovariates = covariateEntries.slice(-2).map(([name]) => name);

    return insights;
  }, [metrics]);

  return {
    // State
    metrics,
    isCalculating,
    showMetrics,
    error,

    // Actions
    calculateMetrics,
    resetMetrics,
    toggleMetrics,

    // Computed values
    qualitySummary,
    covariateQuality,
    shouldReRandomize,
    performanceInsights,

    // Convenience getters
    hasMetrics: !!metrics,
    isGoodQuality: metrics ? metrics.overallQuality.score >= 75 : false,
    isExcellentQuality: metrics ? metrics.overallQuality.score >= 90 : false
  };
}