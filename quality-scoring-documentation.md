# Plate Randomization Quality Scoring System

## Overview

This document describes the quality metrics used to evaluate plate randomization. Two primary scores are used to assess the quality of sample distribution across plates:

1. **Balance Score** - Measures how well each plate represents the overall population
2. **Randomization Score** - Measures spatial clustering and randomness of sample placement

## Balance Score Calculation

### Purpose
The balance score evaluates whether each plate contains a representative sample of the overall population based on selected covariates.

### Methodology

#### Individual Covariate Group Balance
For each covariate combination on each plate:

```
Expected Count = (Group Size / Total Samples) × Plate Capacity
Actual Count = Number of samples from this group on this plate
Expected Proportion = Group Size / Total Samples
Actual Proportion = Actual Count / Plate Capacity

Relative Deviation = |Actual Proportion - Expected Proportion| / Expected Proportion
Balance Score = max(0, 100 - (Relative Deviation × 100))
```

#### Overall Plate Balance Score
The overall balance score for a plate is calculated using weighted averaging:

```
For each covariate group:
  Weight = Expected Proportion (group size / total samples)
  Weighted Deviation = Relative Deviation × Weight
  TotalWeight += Weight;

Overall Balance Score = max(0, 100 - ((Sum of Weighted Deviations)/TotalWeight × 100))
```

### Interpretation

| Score Range | Quality Level | Interpretation |
|-------------|---------------|----------------|
| 90-100 | Excellent | Near-perfect representation of population |
| 80-89 | Good | Minor deviations from expected proportions |
| 70-79 | Fair | Noticeable but acceptable imbalances |
| 60-69 | Poor | Significant imbalances present |
| 0-59 | Very Poor | Major imbalances that may affect study validity |

### Edge Cases

#### Small Groups (< 1 expected sample per plate)
- **Challenge**: Groups with very few samples cannot be evenly distributed
- **Handling**: Uses fractional expected counts; some plates will naturally have 0 samples
- **Scoring**: Relative deviation calculated against fractional expectation

#### Non-Divisible Sample Counts
- **Challenge**: Sample counts that don't divide evenly across plates
- **Handling**: Some plates get ⌊n/plates⌋ samples, others get ⌈n/plates⌉ samples
- **Scoring**: Expected count uses exact fractional calculation


## Randomization Score Calculation

### Purpose
The randomization score measures spatial clustering to ensure similar samples are not grouped together on the plate, which could introduce systematic bias.

### Methodology

#### Spatial Neighbor Analysis
For each sample position on the plate:

1. **Identify Neighbors**: All adjacent positions (8-directional: up, down, left, right, diagonals)
2. **Compare Covariate Keys**: Check if neighbor represents a different covariate group
3. **Count Different Neighbors**: Tally neighbors which represent different covariate groups

#### Score Calculation
```
Total Comparisons = Sum of all neighbor-to-neighbor comparisons
Different Neighbors = Count of neighbors representing different covariate groups

Randomization Score = (Different Neighbors / Total Comparisons) × 100
```

### Interpretation

| Score Range | Quality Level | Interpretation |
|-------------|---------------|----------------|
| 85-100 | Excellent | High spatial randomness, minimal clustering |
| 75-84 | Good | Some minor clustering but generally well-mixed |
| 65-74 | Fair | Moderate clustering present |
| 50-64 | Poor | Significant clustering of similar samples |
| 0-49 | Very Poor | Severe clustering that may introduce bias |

## Overall Quality Assessment

### Plate-Level Overall Score
```
Plate Overall Score = (Balance Score + Randomization Score) / 2
```

### Experiment-Level Scores
```
Average Balance Score = Mean of all plate balance scores
Average Randomization Score = Mean of all plate randomization scores
Overall Experiment Score = (Average Balance + Average Randomization) / 2
```

### Quality Levels

| Overall Score | Level | Description |
|---------------|-------|-------------|
| 85-100 | Excellent | High-quality randomization |
| 75-84 | Good | Acceptable quality with minor issues |
| 65-74 | Fair | Usable? |
| 0-64 | Poor | Significant issues |

## Weighting Considerations

### Proportion-Based Weighting (Current Implementation)
- **Principle**: Larger covariate groups have more impact on study validity
- **Implementation**: Weight = Expected Proportion (group size / total samples)
- **Benefit**: Naturally handles edge cases and reflects real-world importance

### Alternative Weighting Approaches

#### Equal Weighting
- **Principle**: All covariate groups treated equally
- **Implementation**: Weight = 1 for all groups
- **Limitation**: May over-penalize small groups, under-penalize large groups

#### Log-Based Weighting
- **Principle**: Statistical power increases logarithmically with sample size
- **Implementation**: Weight = log₁₀(group size) / 2
- **Limitation**: Somewhat arbitrary scaling factors

## Practical Guidelines

### When to Re-randomize
Consider re-randomization if:
- Overall experiment score < 70
- Any individual plate score < 60
- Critical covariate groups show severe imbalance (>50% deviation)

### Acceptable Trade-offs
- Small groups (< 5% of population) with moderate imbalance are often acceptable
- Perfect balance may be impossible with small sample sizes
- Prioritize balance in larger, more important covariate groups

### Quality Monitoring
- Review both balance and randomization scores
- Examine individual plate details for problematic patterns
- Consider biological/clinical significance of imbalances
- Document any accepted deviations with scientific justification

## Technical Implementation Notes

### Calculation Efficiency
- Single-pass calculation for both overall and detailed balance metrics
- Cached covariate groupings to avoid redundant computations
- Spatial analysis optimized for typical plate dimensions (8×12, 16×24)

### Numerical Stability
- Handles division by zero in expected proportion calculations
- Caps relative deviations at 1.0 to prevent extreme scores
- Uses fractional arithmetic for precise expected count calculations

### Extensibility
- Modular design allows for alternative scoring algorithms
- Configurable weighting schemes
- Support for custom covariate combinations and plate layouts