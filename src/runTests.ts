#!/usr/bin/env node

/**
 * Simple test runner for quality metrics tests
 * Run with: npx ts-node src/runTests.ts
 */

import {
  testSimplifiedQualityMetrics,
  testExpectedRunsByGroup,
  testExpectedRunsEdgeCases,
  testExpectedRunsProperties,
  testCalculateExpectedRunsByGroupDirect,
  testExpectedRunsMathematicalCorrectness,
  testGapBasedExpectedSequences,
  testGapMethodComparison,
  validateSimplifiedQualityMetricsInputs
} from './utils/qualityMetrics.test';

console.log('🧪 Starting Quality Metrics Tests...\n');

try {
  // Run all tests
  console.log('=' .repeat(60));
  testSimplifiedQualityMetrics();

  console.log('=' .repeat(60));
  testExpectedRunsByGroup();

  console.log('=' .repeat(60));
  testExpectedRunsEdgeCases();

  console.log('=' .repeat(60));
  testExpectedRunsProperties();

  console.log('=' .repeat(60));
  testCalculateExpectedRunsByGroupDirect();

  console.log('=' .repeat(60));
  testExpectedRunsMathematicalCorrectness();

  console.log('=' .repeat(60));
  testGapBasedExpectedSequences();

  console.log('=' .repeat(60));
  testGapMethodComparison();

  console.log('\n✅ All tests completed successfully!');

} catch (error) {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
}