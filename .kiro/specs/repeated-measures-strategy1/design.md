# Design Document

## Overview

This document provides a detailed design for implementing repeated-measures variable support in the balanced randomization algorithm using Strategy 1 (Weighted Repeated-measures Groups). The design enables grouping samples from the same subject (e.g., same PatientID) to stay on the same plate while maintaining approximate treatment variable balance across plates.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  - ConfigurationForm: Variable selectors                    │
│  - SummaryPanel: Quality metrics display                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Randomization Controller                    │
│  - balancedBlockRandomization()                             │
│  - Route to standard or repeated-measures-aware path        │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────┐   ┌──────────────────────────┐
│  Standard Path       │   │  Repeated-measures Path  │
│  (existing)          │   │  (new)                   │
└──────────────────────┘   └──────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │ Group Creation   │ │ Distribution     │ │ Row Assignment   │
        │ Module           │ │ Module           │ │ Module           │
        └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Algorithm Flow

```
Input: samples, treatmentVariables, repeatedMeasuresVariable

1. Create Repeated-measures Groups
   ├─ Group samples by repeatedMeasuresVariable value
   ├─ Create singleton groups for samples without value
   └─ Calculate treatment composition for each group

2. Validate Groups
   ├─ Check group sizes vs plate capacity
   ├─ Warn about large groups
   └─ Validate configuration

3. Calculate Plate Capacities
   └─ Based on total samples and keepEmptyInLastPlate setting

4. Distribute Groups to Plates
   ├─ Sort groups by size (largest first)
   ├─ For each group:
   │  ├─ Calculate treatment balance score for each candidate plate
   │  ├─ Check capacity constraints
   │  └─ Assign to plate with best balance score
   └─ Validate no groups split across plates

5. Flatten Groups to Samples
   └─ Convert plate-level group assignments to sample lists

6. Distribute Samples to Rows
   └─ Use existing row distribution algorithm per plate

7. Return Results
   ├─ Plate grid with sample assignments
   ├─ Quality metrics
   └─ Repeated-measures group information

Output: plates[][][] with samples positioned
```

## Components and Interfaces

### 1. Data Models

#### RepeatedMeasuresGroup Interface

```typescript
/**
 * Represents a group of samples from the same subject that must
 * stay together on the same plate
 */
export interface RepeatedMeasuresGroup {
  /** Unique identifier for this group (e.g., "Patient_001") */
  subjectId: string;

  /** All samples belonging to this group */
  samples: SearchData[];

  /**
   * Treatment composition of this group
   * Maps treatment combination key to count of samples
   * Example: {"Drug|Timepoint_0": 2, "Drug|Timepoint_10": 1}
   *
   * Note: A repeated-measures group can contain samples with
   * DIFFERENT treatment variable values (e.g., different timepoints)
   */
  treatmentComposition: Map<string, number>;

  /** Total number of samples in this group */
  size: number;

  /** Whether this is a singleton group (sample without subject ID) */
  isSingleton: boolean;
}
```

#### RandomizationConfig Interface

```typescript
/**
 * Configuration for randomization with optional repeated-measures support
 */
export interface RandomizationConfig {
  /** Variables used for treatment balancing */
  treatmentVariables: string[];

  /** Variable used for repeated-measures grouping (optional) */
  repeatedMeasuresVariable?: string;

  /** Standard randomization parameters */
  keepEmptyInLastPlate: boolean;
  numRows: number;
  numColumns: number;
}
```

#### Enhanced Return Type

```typescript
export interface RandomizationResult {
  /** 3D array: plates[plateIdx][rowIdx][colIdx] = SearchData | undefined */
  plates: (SearchData | undefined)[][][];

  /** Map of plate index to samples assigned to that plate */
  plateAssignments?: Map<number, SearchData[]>;

  /** Repeated-measures groups created (if applicable) */
  repeatedMeasuresGroups?: RepeatedMeasuresGroup[];

  /** Quality metrics for the randomization */
  qualityMetrics?: RepeatedMeasuresQualityMetrics;
}
```

#### Quality Metrics Interface

```typescript
export interface RepeatedMeasuresQualityMetrics {
  /** Whether repeated-measures constraints are satisfied */
  repeatedMeasuresConstraintsSatisfied: boolean;

  /** Number of groups split across plates (should be 0) */
  repeatedMeasuresViolations: number;

  /** Treatment balance score (0-100, higher is better) */
  treatmentBalanceScore: number;

  /** Per-plate repeated-measures group counts */
  plateGroupCounts: number[];

  /** Distribution of group sizes */
  groupSizeDistribution: {
    singletons: number;
    small: number;    // 2-5 samples
    medium: number;   // 6-15 samples
    large: number;    // 16+ samples
  };

  /** Standard quality metrics */
  standardMetrics: QualityMetrics;
}
```

### 2. Module Structure

#### New Files to Create

```
src/
├── algorithms/
│   ├── balancedRandomization.ts (MODIFY)
│   ├── repeatedMeasuresGrouping.ts (NEW)
│   └── repeatedMeasuresDistribution.ts (NEW)
├── utils/
│   ├── types.ts (MODIFY - add new interfaces)
│   └── qualityMetrics.ts (MODIFY - add repeated-measures metrics)
└── components/
    ├── ConfigurationForm.tsx (MODIFY - add selector)
    └── SummaryPanel.tsx (MODIFY - add metrics display)
```

### 3. Core Functions

#### Module: repeatedMeasuresGrouping.ts

```typescript
/**
 * Creates repeated-measures groups from samples
 *
 * @param samples All samples to be randomized
 * @param repeatedMeasuresVariable Variable used for grouping (e.g., "PatientID")
 * @param treatmentVariables Variables used for treatment balancing
 * @returns Array of repeated-measures groups
 */
export function createRepeatedMeasuresGroups(
  samples: SearchData[],
  repeatedMeasuresVariable: string,
  treatmentVariables: string[]
): RepeatedMeasuresGroup[]

/**
 * Validates repeated-measures groups for common issues
 *
 * @param groups Groups to validate
 * @param plateCapacity Maximum samples per plate
 * @returns Validation result with errors and warnings
 */
export function validateRepeatedMeasuresGroups(
  groups: RepeatedMeasuresGroup[],
  plateCapacity: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

#### Module: repeatedMeasuresDistribution.ts

```typescript
/**
 * Distributes repeated-measures groups to plates using balanced best-fit
 *
 * @param groups Groups to distribute
 * @param plateCapacities Capacity of each plate
 * @param treatmentVariables Variables for balancing
 * @returns Map of plate index to assigned groups
 */
export function distributeGroupsToPlates(
  groups: RepeatedMeasuresGroup[],
  plateCapacities: number[],
  treatmentVariables: string[]
): Map<number, RepeatedMeasuresGroup[]>

/**
 * Calculates treatment balance score for adding a group to a plate
 * Lower score = better balance
 *
 * @param plateIdx Index of candidate plate
 * @param group Group to potentially add
 * @param currentAssignments Current plate assignments
 * @param plateCounts Current sample counts per plate
 * @param globalTreatmentCounts Global treatment distribution
 * @param totalSamples Total number of samples
 * @returns Balance score (lower is better)
 */
function calculateBalanceScore(
  plateIdx: number,
  group: RepeatedMeasuresGroup,
  currentAssignments: Map<number, RepeatedMeasuresGroup[]>,
  plateCounts: number[],
  globalTreatmentCounts: Map<string, number>,
  totalSamples: number
): number
```

#### Module: balancedRandomization.ts (Modified)

```typescript
/**
 * Main randomization function with repeated-measures support
 *
 * @param searches All samples to randomize
 * @param config Configuration including treatment and repeated-measures variables
 * @returns Randomization result with plates and metadata
 */
export function balancedBlockRandomization(
  searches: SearchData[],
  config: RandomizationConfig
): RandomizationResult

/**
 * Repeated-measures-aware randomization implementation
 * (Internal function)
 */
function doRepeatedMeasuresAwareRandomization(
  searches: SearchData[],
  config: RandomizationConfig
): RandomizationResult

/**
 * Standard randomization (existing algorithm)
 * (Internal function)
 */
function doStandardRandomization(
  searches: SearchData[],
  config: RandomizationConfig
): RandomizationResult

/**
 * Validates that repeated-measures constraints are satisfied
 * (Internal function)
 */
function validateRepeatedMeasuresConstraints(
  plateAssignments: Map<number, SearchData[]>,
  repeatedMeasuresVariable: string
): void
```

## Data Flow

### 1. Group Creation Phase

```
Input: samples[], repeatedMeasuresVariable, treatmentVariables

Process:
1. Create Map<subjectId, samples[]>
   - For each sample:
     - Get subjectId = sample.metadata[repeatedMeasuresVariable]
     - If no subjectId: create unique singleton ID
     - Add sample to map[subjectId]

2. Convert to RepeatedMeasuresGroup[]
   - For each (subjectId, samples) in map:
     - Calculate treatmentComposition:
       - For each sample in samples:
         - Get treatmentKey = getCovariateKey(sample, treatmentVariables)
         - Increment treatmentComposition[treatmentKey]
     - Create group object

Output: RepeatedMeasuresGroup[]
```

### 2. Distribution Phase

```
Input: groups[], plateCapacities[], treatmentVariables, samples[]

Process:
1. Calculate global treatment distribution from original samples
   - For each sample in samples[]:
     - Get treatmentKey = getCovariateKey(sample, treatmentVariables)
     - Increment globalTreatmentCounts[treatmentKey]
   - This gives us the target proportions for balancing

2. Sort groups by size (largest first)
   - Improves bin packing efficiency

3. Initialize plate assignments
   - plateAssignments = Map<plateIdx, groups[]>
   - plateCounts = array of current sample counts per plate

4. For each group (in sorted order):
   - Find best plate:
     - For each candidate plate:
       - Check: plateCounts[plateIdx] + group.size <= plateCapacities[plateIdx]
       - If fits: calculate balance score
     - Select plate with lowest balance score
   - Assign group to best plate
   - Update plateCounts[plateIdx] += group.size

Output: Map<plateIdx, groups[]>
```

### 3. Balance Score Calculation

```
Input: plateIdx, group, currentAssignments, plateCounts, globalTreatmentCounts, totalSamples

Process:
1. Calculate current plate composition
   - For each group already on plate:
     - Add group.treatmentComposition to currentComposition

2. Calculate hypothetical composition
   - hypotheticalComposition = currentComposition + group.treatmentComposition

3. Calculate deviation from expected proportions
   - hypotheticalPlateSize = plateCounts[plateIdx] + group.size
   - totalDeviation = 0
   - For each (treatmentKey, globalCount) in globalTreatmentCounts:
     - expectedProportion = globalCount / totalSamples
     - expectedCount = expectedProportion * hypotheticalPlateSize
     - actualCount = hypotheticalComposition[treatmentKey] || 0
     - deviation = |actualCount - expectedCount|
     - totalDeviation += deviation

Output: totalDeviation (lower = better balance)

Example with rare treatment group:
- Total samples: 672 (7 plates × 96 samples)
- Treatment group "Drug_X": 4 samples globally
- Plate 1 currently has 80 samples
- Considering adding a group with 8 samples (none are Drug_X)

Calculation:
- expectedProportion = 4 / 672 = 0.00595
- hypotheticalPlateSize = 80 + 8 = 88
- expectedCount = 0.00595 × 88 = 0.524
- actualCount = 0 (no Drug_X samples on this plate)
- deviation = |0 - 0.524| = 0.524

This small deviation is acceptable and expected for rare groups.
The algorithm will naturally spread rare samples across plates
as best as possible given the repeated-measures constraints.
```

## Error Handling

### Validation Errors (Block Execution)

1. **Oversized Group Error**
   - Condition: Any group.size > plateCapacity
   - Message: "Repeated-measures group '[subjectId]' has [size] samples, which exceeds plate capacity of [capacity]. Please increase plate size or split this group."
   - Action: Prevent randomization execution

2. **Variable Conflict Error**
   - Condition: repeatedMeasuresVariable in treatmentVariables
   - Message: "A variable cannot be both a treatment variable and a repeated-measures variable. Please select different variables."
   - Action: Prevent randomization execution

3. **Distribution Failure Error**
   - Condition: Cannot fit group in any plate
   - Message: "Cannot fit repeated-measures group '[subjectId]' ([size] samples) in any available plate. This may indicate insufficient total capacity."
   - Action: Throw error during randomization

### Validation Warnings (Allow Execution)

1. **Large Group Warning**
   - Condition: Any group.size > plateCapacity * 0.5
   - Message: "Repeated-measures group '[subjectId]' has [size] samples ([percentage]% of plate capacity). Large groups may limit balancing flexibility."
   - Action: Display warning, allow execution

2. **High Singleton Ratio Warning**
   - Condition: singletonCount / totalGroups > 0.8
   - Message: "High proportion of singleton groups ([percentage]%). Consider verifying that '[repeatedMeasuresVariable]' is the correct variable for grouping."
   - Action: Display warning, allow execution

3. **Imperfect Balance Warning**
   - Condition: treatmentBalanceScore < threshold
   - Message: "Treatment balance may not be perfect due to repeated-measures constraints. Balance score: [score]/100"
   - Action: Display in results, allow execution

## Testing Strategy

### Unit Tests

#### repeatedMeasuresGrouping.test.ts

```typescript
describe('createRepeatedMeasuresGroups', () => {
  test('groups samples by subject ID')
  test('creates singletons for samples without subject ID')
  test('calculates treatment composition correctly')
  test('handles multiple treatment variables')
  test('handles empty sample array')
})

describe('validateRepeatedMeasuresGroups', () => {
  test('detects oversized groups')
  test('warns about large groups')
  test('warns about high singleton ratio')
  test('passes validation for valid groups')
})
```

#### repeatedMeasuresDistribution.test.ts

```typescript
describe('distributeGroupsToPlates', () => {
  test('keeps groups together on same plate')
  test('respects plate capacity constraints')
  test('distributes groups across multiple plates')
  test('handles single plate scenario')
  test('throws error when group cannot fit')
})

describe('calculateBalanceScore', () => {
  test('calculates deviation from expected proportions')
  test('handles multiple treatment combinations')
  test('returns lower score for better balance')
})
```

### Integration Tests

#### repeatedMeasuresRandomization.test.ts

```typescript
describe('repeated-measures-aware randomization', () => {
  test('end-to-end: simple case with equal groups')
  test('end-to-end: uneven group sizes')
  test('end-to-end: mixed groups and singletons')
  test('end-to-end: multiple plates')
  test('validates repeated-measures constraints')
  test('maintains approximate treatment balance')
  test('backward compatibility: no repeated-measures variable')
})
```

### Performance Tests

```typescript
describe('performance', () => {
  test('handles 1000 samples with 100 groups in < 2 seconds')
  test('handles 5000 samples with 500 groups in < 10 seconds')
  test('memory usage remains reasonable for large datasets')
})
```

## UI/UX Design

### Configuration Form Updates

```
┌─────────────────────────────────────────────────────────┐
│ Select Treatment Variables                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☑ Treatment                                         │ │
│ │ ☑ Timepoint                                         │ │
│ │ ☐ Gender                                            │ │
│ │ ☐ PatientID                                         │ │
│ └─────────────────────────────────────────────────────┘ │
│ Select variables to balance across plates               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Select Repeated-measures Variables (Optional)           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ▼ PatientID                                         │ │
│ │   None                                              │ │
│ │   Gender                                            │ │
│ │ ► PatientID                                         │ │
│ └─────────────────────────────────────────────────────┘ │
│ Select a variable to group samples from the same        │
│ subject that must stay on the same plate (e.g.,        │
│ PatientID)                                              │
│                                                         │
│ ℹ All samples with the same PatientID value will be    │
│   assigned to the same plate                           │
└─────────────────────────────────────────────────────────┘
```

### Summary Panel Updates

```
┌─────────────────────────────────────────────────────────┐
│ Randomization Summary                                   │
├─────────────────────────────────────────────────────────┤
│ Total Samples: 96                                       │
│ Plates: 1                                               │
│ Plate Size: 8 rows × 12 columns                        │
│                                                         │
│ Repeated-measures Groups (PatientID)                    │
│ ├─ Total groups: 12                                    │
│ ├─ Multi-sample groups: 10                             │
│ ├─ Singleton groups: 2                                 │
│ └─ Largest group: Patient_003 (12 samples)             │
│                                                         │
│ Treatment Balance                                       │
│ ├─ Balance score: 92/100                               │
│ └─ Status: Good ✓                                      │
│                                                         │
│ Plate 1                                                 │
│ ├─ Samples: 96                                         │
│ ├─ Repeated-measures groups: 12                        │
│ └─ Treatment distribution:                             │
│     • Drug|T0: 24 (expected: 24)                       │
│     • Drug|T10: 24 (expected: 24)                      │
│     • Placebo|T0: 24 (expected: 24)                    │
│     • Placebo|T10: 24 (expected: 24)                   │
└─────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Optimization Strategies

1. **Pre-calculate Treatment Compositions**
   - Calculate once during group creation
   - Store in RepeatedMeasuresGroup object
   - Avoid recalculation during distribution

2. **Efficient Data Structures**
   - Use Map for O(1) lookups
   - Use arrays for plate counts (O(1) access)
   - Avoid nested loops where possible

3. **Early Termination**
   - Check capacity before calculating balance score
   - Skip plates that cannot fit the group
   - Validate groups before distribution

4. **Sorting Strategy**
   - Sort groups by size (largest first)
   - Improves bin packing efficiency
   - Reduces fragmentation

### Expected Performance

- **Small datasets** (< 100 samples): < 100ms
- **Medium datasets** (100-1000 samples): < 1 second
- **Large datasets** (1000-5000 samples): < 5 seconds

## Backward Compatibility

### Maintaining Existing Behavior

1. **Function Signature**
   - Keep existing parameters optional
   - Add new parameters as optional
   - Return type extends existing type

2. **Code Path Separation**
   - If repeatedMeasuresVariable is undefined: use existing algorithm
   - If repeatedMeasuresVariable is defined: use new algorithm
   - No changes to existing algorithm code

3. **Testing**
   - Run existing test suite with no repeated-measures variable
   - Verify identical results to previous version
   - Add new tests for repeated-measures functionality

## Future Enhancements

### Phase 2 Improvements (Optional)

1. **Local Search Optimization**
   - After initial distribution, try swapping groups between plates
   - Improve treatment balance while maintaining repeated-measures constraints
   - Implement simulated annealing or hill climbing

2. **Multiple Repeated-measures Levels**
   - Support hierarchical grouping (e.g., Patient > Sample > Aliquot)
   - Nested constraints for complex experimental designs

3. **Advanced Constraints**
   - Spatial constraints (avoid adjacent plates)
   - Batch effect mitigation
   - Custom user-defined constraints

4. **Enhanced Visualization**
   - Show repeated-measures groups in plate layout
   - Color-code by subject ID
   - Interactive group inspection

## Implementation Notes

### Key Design Decisions

1. **Singleton Handling**
   - Samples without subject IDs get unique singleton IDs
   - Prevents artificial grouping of unrelated samples
   - Allows independent distribution

2. **Treatment Composition Storage**
   - Store as Map<string, number> in group object
   - Enables efficient balance calculation
   - Handles multiple treatment combinations per group

3. **Balance Scoring**
   - Use absolute deviation from expected proportions
   - Sum across all treatment combinations
   - Lower score = better balance

4. **Greedy Algorithm**
   - Simple and fast
   - Good results for most cases
   - Can be enhanced with local search later

### Potential Pitfalls

1. **Large Groups**
   - May prevent good balance
   - Validate and warn user
   - Suggest larger plates if needed

2. **Uneven Treatment Distribution**
   - Some groups may be all one treatment
   - Accept imperfect balance
   - Report balance score to user

3. **Capacity Planning**
   - Must account for group atomicity
   - Cannot split groups across plates
   - May need more plates than standard algorithm

4. **Rare Treatment Groups**
   - When a treatment group has very few samples globally (e.g., 4 samples across 7 plates)
   - Expected count per plate will be fractional and small (e.g., 4/7 ≈ 0.57 samples per plate)
   - Balance score calculation still works:
     - If plate gets 0 samples: deviation = |0 - 0.57| = 0.57
     - If plate gets 1 sample: deviation = |1 - 0.57| = 0.43
     - If plate gets 2 samples: deviation = |2 - 0.57| = 1.43
   - Algorithm will naturally distribute rare samples across plates
   - Some plates will have 0, some will have 1 (or more if in a repeated-measures group)
   - This is expected behavior - perfect balance is impossible with rare groups
   - Balance score reflects this reality and helps choose best available distribution
