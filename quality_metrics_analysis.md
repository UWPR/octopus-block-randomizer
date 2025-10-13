# Quality Metrics Analysis: CV, Chi-Squared, P-Value, and Balance Score

## Table of Contents

1. [Overview](#overview)
2. [Statistical Measures](#statistical-measures)
   - [1. Coefficient of Variation (CV)](#1-coefficient-of-variation-cv)
   - [2. Chi-Squared (χ²)](#2-chi-squared-χ²)
   - [3. P-Value](#3-p-value)
3. [Comparability Analysis](#comparability-analysis)
   - [Cross-Group Comparisons](#cross-group-comparisons)
   - [Example Comparison](#example-comparison)
4. [Balance Score Analysis](#balance-score-analysis)
   - [Current Implementation](#current-implementation)
   - [Problems with Current Formula](#problems-with-current-formula)
   - [Standard Approaches in Literature](#standard-approaches-in-literature)
   - [Recommended Improved Formula](#recommended-improved-formula)
5. [Key Insights](#key-insights)
   - [1. Statistical vs Practical Significance](#1-statistical-vs-practical-significance)
   - [2. Sample Size Effects](#2-sample-size-effects)
   - [3. Metric Selection for Different Purposes](#3-metric-selection-for-different-purposes)
6. [Plate-Level Diversity Metrics](#plate-level-diversity-metrics)
   - [Current Implementation Issues](#current-implementation-issues)
   - [Two Distinct Concepts: Entropy vs Proportional Accuracy](#two-distinct-concepts-entropy-vs-proportional-accuracy)
   - [Critical Distinction: Entropy ≠ Proportional Accuracy](#critical-distinction-entropy--proportional-accuracy)
   - [Recommended Dual-Metric Approach](#recommended-dual-metric-approach)
7. [Recommendations](#recommendations)
   - [Immediate Improvements](#immediate-improvements)
   - [Display Improvements](#display-improvements)
   - [Long-term Enhancements](#long-term-enhancements)
8. [Conclusion](#conclusion)

---

## Overview

This document summarizes the statistical measures used in our block randomization quality assessment system, their calculations, interpretations, and limitations.

## Statistical Measures

### 1. Coefficient of Variation (CV)

#### **Calculation**
```typescript
const mean = actualCounts.reduce((sum, val) => sum + val, 0) / actualCounts.length;
const variance = actualCounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / actualCounts.length;
const std = Math.sqrt(variance);
const coefficientOfVariation = mean > 0 ? (std / mean) * 100 : 0;
```

#### **Formula**
```
CV = (Standard Deviation / Mean) × 100
```

#### **Example**
For covariate combination "Male|Young|TreatmentA" (18 samples across 5 plates):
- Expected per plate: 3.6
- Actual distribution: [2, 4, 3, 4, 5]
- Mean = 3.6, Std Dev = 1.02
- **CV = (1.02 / 3.6) × 100 = 28.3%**

#### **Interpretation**
- **CV = 0%**: Perfect balance (impossible with real samples)
- **CV < 20%**: Excellent balance
- **CV 20-40%**: Good balance
- **CV 40-60%**: Fair balance
- **CV > 60%**: Poor balance

#### **Key Properties**
- ✅ **Normalized measure**: Accounts for different sample sizes
- ✅ **Comparable across groups**: Can compare CV between different covariate combinations
- ✅ **Intuitive**: Higher CV = worse balance
- ✅ **Scale-independent**: Same interpretation regardless of group size

### 2. Chi-Squared (χ²)

#### **Calculation**
```typescript
let chiSquare = 0;
for (let i = 0; i < observed.length; i++) {
  if (expected[i] > 0) {
    chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
  }
}
```

#### **Formula**
```
χ² = Σ [(Observed - Expected)² / Expected]
```

#### **Example**
For the same "Male|Young|TreatmentA" example:
- Expected per plate: 3.6
- Actual: [2, 4, 3, 4, 5]

```
Plate 1: (2 - 3.6)² / 3.6 = 0.71
Plate 2: (4 - 3.6)² / 3.6 = 0.04
Plate 3: (3 - 3.6)² / 3.6 = 0.10
Plate 4: (4 - 3.6)² / 3.6 = 0.04
Plate 5: (5 - 3.6)² / 3.6 = 0.54

χ² = 0.71 + 0.04 + 0.10 + 0.04 + 0.54 = 1.43
```

#### **Interpretation**
- **χ² = 0**: Perfect balance (observed = expected exactly)
- **χ² < 5**: Generally good balance for small samples
- **χ² > 10**: Potentially concerning imbalance
- **Higher χ²**: Greater deviation from expected distribution

#### **Key Properties**
- ✅ **Measures magnitude**: Shows how far actual distribution is from expected
- ❌ **NOT comparable across groups**: Different sample sizes produce different scales
- ❌ **Scale-dependent**: Larger expected values lead to larger χ² values
- ⚠️ **Requires context**: Must be interpreted with degrees of freedom

### 3. P-Value

#### **Calculation (Current Implementation)**
```typescript
const degreesOfFreedom = Math.max(1, validComparisons - 1);
const pValue = Math.exp(-chiSquare / (2 * degreesOfFreedom));
```

**⚠️ Note**: This is a simplified approximation. Proper implementation would use chi-squared distribution CDF.

#### **Interpretation**
The p-value answers: *"What's the probability of getting a chi-squared value this high or higher by random chance alone?"*

- **p > 0.05**: Imbalance could be due to random chance ✅
- **p ≤ 0.05**: Imbalance is statistically significant ⚠️
- **p ≤ 0.01**: Strong evidence of systematic imbalance 🔴

#### **Example**
For χ² = 1.43 with df = 4:
- **p ≈ 0.84**
- **Interpretation**: "If we had perfect randomization and repeated this experiment 1000 times, we'd expect to see χ² ≥ 1.43 about 840 times. This is very common and acceptable."

#### **Key Properties**
- ✅ **Comparable across groups**: Can compare p-values between different sample sizes
- ✅ **Statistical significance**: Distinguishes random vs systematic imbalance
- ✅ **Standard interpretation**: Widely accepted thresholds (0.05, 0.01)
- ⚠️ **Implementation issue**: Our current calculation is simplified

## Comparability Analysis

### Cross-Group Comparisons

| Measure | Comparable Across Different Group Sizes? | Why? |
|---------|------------------------------------------|------|
| **CV** | ✅ **YES** | Normalized by mean, scale-independent |
| **Chi-squared** | ❌ **NO** | Scale-dependent, affected by sample size |
| **P-value** | ✅ **YES** | Accounts for degrees of freedom |

### Example Comparison

```
Group A: "Male|Young|TreatmentA" (18 samples)
- CV = 28.3%, χ² = 1.43, p = 0.84

Group B: "Female|Old|Control" (6 samples)
- CV = 58.3%, χ² = 2.5, p = 0.64

Valid Comparisons:
✅ CV: Group A (28.3%) has better balance than Group B (58.3%)
✅ P-value: Both groups show acceptable balance (p > 0.05)
❌ Chi-squared: Cannot directly compare 1.43 vs 2.5 (different scales)
```

## Balance Score Analysis

### Current Implementation

```typescript
const balanceScore = Math.max(0, 100 - (coefficientOfVariation * 2));
```

### Problems with Current Formula

❌ **Not a standard formula**: Completely arbitrary, no statistical basis
❌ **Poor behavior**: CV of 50% gives score of 0, same as CV of 60%
❌ **Ignores context**: No consideration of sample size or statistical significance
❌ **Arbitrary multiplier**: The "× 2" has no theoretical justification

### Standard Approaches in Literature

#### **Clinical Trial Standards**
- **Primary**: Statistical significance (p-values)
- **Secondary**: Effect sizes (standardized mean differences)
- **Reporting**: Descriptive statistics + hypothesis tests

#### **Standardized Mean Difference (Cohen's d)**
```
SMD < 0.1: Negligible imbalance
SMD < 0.2: Small imbalance
SMD < 0.5: Medium imbalance
SMD ≥ 0.5: Large imbalance
```

### Recommended Improved Formula

```typescript
const calculateBalanceScore = (
  actualCounts: number[],
  expectedCounts: number[],
  pValue: number,
  sampleSize: number
): number => {
  // Factor 1: Statistical significance (primary - 70% weight)
  const significanceScore = pValue >= 0.05 ? 100 :
                           pValue >= 0.01 ? 75 :
                           pValue >= 0.001 ? 50 : 25;

  // Factor 2: Effect size adjusted for sample size (30% weight)
  const cv = calculateCV(actualCounts);
  const expectedRandomCV = Math.sqrt(1 / sampleSize) * 100;
  const effectScore = cv <= expectedRandomCV ? 100 :
                     cv <= expectedRandomCV * 2 ? 75 :
                     cv <= expectedRandomCV * 3 ? 50 : 25;

  // Weighted combination
  return Math.round(significanceScore * 0.7 + effectScore * 0.3);
};
```

#### **Benefits of Improved Formula**
- ✅ **Evidence-based**: Uses established statistical principles
- ✅ **Interpretable**: Clear thresholds based on significance levels
- ✅ **Context-aware**: Adjusts for sample size
- ✅ **Defensible**: Can be explained to regulatory authorities

## Key Insights

### 1. Statistical vs Practical Significance

**Perfect randomization doesn't mean perfect balance!** Even ideal randomization produces some imbalance due to chance.

- **High CV, High p-value**: Variation exists but likely due to random chance → Usually acceptable
- **High CV, Low p-value**: Variation is statistically significant → Indicates systematic problem
- **Low CV, Low p-value**: Rare scenario, might indicate over-optimization

### 2. Sample Size Effects

**Larger samples generally achieve better balance:**
- More opportunities for even distribution
- Statistical tests have more power to detect true imbalances
- CV values tend to be lower and more stable

### 3. Metric Selection for Different Purposes

**For comparing balance across groups**: Use CV and p-values
**For detecting systematic problems**: Use p-values primarily
**For practical impact assessment**: Use CV
**Avoid**: Direct comparison of raw chi-squared values

## Recommendations

### Immediate Improvements

1. **Replace arbitrary balance score formula** with evidence-based approach
2. **Fix p-value calculation** to use proper chi-squared distribution
3. **Add sample size context** to balance interpretation
4. **Emphasize p-values** for statistical significance assessment

### Display Improvements

Instead of showing raw chi-squared values:
```typescript
// Current (misleading)
<span>χ²: {formatScore(balance.chiSquare)}</span>

// Better options
<span>Significance: {balance.pValue < 0.05 ? 'Poor' : 'Good'}</span>
<span>p-value: {balance.pValue.toFixed(3)}</span>
```

### Long-term Enhancements

1. **Implement proper statistical library** for accurate p-value calculations
2. **Add confidence intervals** for balance estimates
3. **Include effect size measures** (standardized mean differences)
4. **Provide contextual guidance** based on sample sizes and study design

## Plate-Level Diversity Metrics

### Current Implementation Issues

The current "Average Diversity" metric uses a deviation-based approach that has several limitations:

```typescript
// Current approach - deviation-based
const deviation = Math.abs(actual - expectedSize) / expectedSize;
const score = Math.max(0, 100 - (deviation * 100));
```

**Problems:**
- ❌ **Ad-hoc formula** - no theoretical foundation
- ❌ **Inconsistent with covariate balance** - uses different scoring approach
- ❌ **Limited interpretability** - arbitrary 0-100 scale

### Two Distinct Concepts: Entropy vs Proportional Accuracy

#### **Entropy (Diversity)**

**What it measures:** *"How diverse/mixed is this plate?"*

**Formula:**
```
H = -Σ(pi × log₂(pi))
where pi = proportion of samples from covariate combination i in the plate
```

**Implementation:**
```typescript
const calculatePlateEntropy = (
  plateSamples: SearchData[],
  selectedCovariates: string[]
): number => {
  if (plateSamples.length === 0) return 0;

  const combinationCounts = new Map<string, number>();

  plateSamples.forEach(sample => {
    const key = getCovariateKey(sample, selectedCovariates);
    combinationCounts.set(key, (combinationCounts.get(key) || 0) + 1);
  });

  let entropy = 0;
  const totalSamples = plateSamples.length;

  combinationCounts.forEach(count => {
    const proportion = count / totalSamples;
    if (proportion > 0) {
      entropy -= proportion * Math.log2(proportion);
    }
  });

  return entropy;
};
```

**Normalized Entropy (0-100 scale):**
```typescript
const normalizedEntropy = (entropy / Math.log2(totalPossibleCombinations)) * 100;
```

#### **Proportional Accuracy (Representativeness)**

**What it measures:** *"Does each plate have the right proportions of each combination?"*

**Implementation:**
```typescript
const calculateProportionalAccuracy = (
  plateSamples: SearchData[],
  globalProportions: Map<string, number>,
  selectedCovariates: string[]
): number => {
  const plateCombinations = groupByCovariates(plateSamples, selectedCovariates);
  const plateSize = plateSamples.length;

  let totalDeviation = 0;
  let validComparisons = 0;

  globalProportions.forEach((globalProportion, combination) => {
    const actualCount = plateCombinations.get(combination)?.length || 0;
    const actualProportion = actualCount / plateSize;
    const expectedProportion = globalProportion;

    const deviation = Math.abs(actualProportion - expectedProportion);
    totalDeviation += deviation;
    validComparisons++;
  });

  const averageDeviation = totalDeviation / validComparisons;
  return Math.max(0, 100 - (averageDeviation * 100));
};
```

### Critical Distinction: Entropy ≠ Proportional Accuracy

#### **Example: High Entropy, Poor Proportional Accuracy**

**Global Dataset:**
- Combination A: 80% (very common)
- Combination B: 15% (uncommon)
- Combination C: 5% (rare)

**Plate 1 (20 samples):**
- Combination A: 7 samples (35%) ← Should be ~16 samples (80%)
- Combination B: 7 samples (35%) ← Should be ~3 samples (15%)
- Combination C: 6 samples (30%) ← Should be ~1 sample (5%)

**Results:**
```
Entropy: 1.58 bits (100% normalized) ✅ Maximum diversity
Proportional Accuracy: ~25/100 ❌ Poor representation
```

#### **Example: Lower Entropy, Better Proportional Accuracy**

**Plate 2 (20 samples):**
- Combination A: 16 samples (80%) ✅ Correct proportion
- Combination B: 3 samples (15%) ✅ Correct proportion
- Combination C: 1 sample (5%) ✅ Correct proportion

**Results:**
```
Entropy: 0.88 bits (56% normalized) ⚠️ Lower diversity
Proportional Accuracy: ~100/100 ✅ Perfect representation
```

### Comparison Table

| Plate | Entropy Score | Proportional Accuracy | Interpretation |
|-------|---------------|----------------------|----------------|
| **Plate 1** | 100 (max diversity) | 25 (poor accuracy) | Diverse but wrong proportions |
| **Plate 2** | 56 (lower diversity) | 100 (perfect accuracy) | Less diverse but correct proportions |

### Key Insights

#### **What Each Metric Tells Us:**

**Entropy (Diversity):**
- ✅ **High entropy**: All combinations roughly equally represented
- ✅ **Low entropy**: Some combinations dominate others
- ❌ **Does NOT indicate**: Whether proportions match expected values

**Proportional Accuracy (Representativeness):**
- ✅ **High accuracy**: Plate matches global proportions well
- ✅ **Low accuracy**: Plate is biased toward certain combinations
- ✅ **Critical for**: Ensuring plates are representative samples

#### **For Randomization Quality:**

**Proportional accuracy is generally more important than entropy** because:
- Each plate should be a representative sample of the overall population
- Systematic bias in plate composition affects experimental validity
- Statistical analysis assumes representative sampling within blocks

### Recommended Dual-Metric Approach

```typescript
interface PlateQuality {
  entropy: number;              // 0-100: How diverse is the plate?
  proportionalAccuracy: number; // 0-100: How accurate are the proportions?
  overallQuality: number;       // Combined score
}

const calculatePlateQuality = (
  plateSamples: SearchData[],
  globalProportions: Map<string, number>,
  selectedCovariates: string[]
): PlateQuality => {
  const entropy = calculateNormalizedEntropy(
    plateSamples,
    selectedCovariates,
    globalProportions.size
  );

  const proportionalAccuracy = calculateProportionalAccuracy(
    plateSamples,
    globalProportions,
    selectedCovariates
  );

  // Weight proportional accuracy more heavily for randomization quality
  const overallQuality = (entropy * 0.3) + (proportionalAccuracy * 0.7);

  return { entropy, proportionalAccuracy, overallQuality };
};
```

### Benefits of Dual-Metric Approach

#### **Entropy Benefits:**
- ✅ **Theoretically grounded** - based on information theory
- ✅ **Standard metric** - widely used across disciplines
- ✅ **Handles complexity** - scales naturally with number of combinations
- ✅ **Detects dominance** - identifies plates dominated by few combinations

#### **Proportional Accuracy Benefits:**
- ✅ **Directly relevant** - measures what we actually care about
- ✅ **Interpretable** - clear meaning for experimental design
- ✅ **Actionable** - identifies specific proportion problems
- ✅ **Validates randomization** - ensures representative sampling

### Implementation Recommendation

**Replace current "Average Diversity" with:**

1. **Plate Entropy Score** - measures diversity within each plate
2. **Plate Proportional Accuracy** - measures representativeness of each plate
3. **Combined Plate Quality** - weighted combination emphasizing accuracy

**Display Enhancement:**
```
Current: Avg Diversity: 75.3

Enhanced:
Avg Proportional Accuracy: 85.2
Avg Entropy (Diversity): 67.8
Combined Plate Quality: 79.1
```

This approach provides both theoretical rigor (entropy) and practical relevance (proportional accuracy) for comprehensive plate quality assessment.

## Conclusion

The current quality metrics system provides a good foundation but has several statistical limitations. The most critical issues are:

1. **Arbitrary balance score formula** that lacks statistical justification
2. **Simplified p-value calculation** that may be inaccurate
3. **Insufficient use of statistical significance** in balance assessment
4. **Conflated diversity concepts** - mixing entropy and proportional accuracy
5. **Ad-hoc plate diversity calculation** without theoretical foundation

Addressing these issues would significantly improve the reliability and interpretability of the randomization quality metrics, making them more suitable for regulatory and scientific scrutiny. The dual-metric approach for plate quality (entropy + proportional accuracy) would provide both theoretical rigor and practical relevance for comprehensive assessment.