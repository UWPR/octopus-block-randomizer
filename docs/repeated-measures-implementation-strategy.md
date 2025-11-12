# Repeated-measures Variable Implementation Strategy

## Overview

This document outlines strategies for implementing repeated-measures variables in the balanced randomization algorithm. Repeated-measures variables (e.g., PatientID) create groups of samples that must be assigned to the same plate while maintaining treatment variable balance.

## Requirements

1. **Repeated-measures variable selection**: Selected separately from treatment variables
2. **Mutual exclusivity**: A variable cannot be both treatment and repeated-measures
3. **Grouping constraint**: All samples with the same subject ID must be on the same plate
4. **Treatment balance**: Maintain approximate balance of treatment variables across plates
5. **Capacity awareness**: Repeated-measures groups must fit within plate capacities

## Problem Characteristics

### Key Insight
Repeated-measures variables create **sample groups that must stay together** on the same plate, while treatment variables define groups that should be **balanced across plates**.

### Challenges
- **Variable group sizes**: Repeated-measures groups can have different numbers of samples
- **Bin packing problem**: Distributing variable-sized groups to fixed-capacity plates (NP-hard)
- **Competing objectives**: Perfect treatment balance may be impossible with repeated-measures constraints
- **Capacity planning**: Need to ensure repeated-measures groups don't exceed plate capacity

---

## Strategy 1: Weighted Repeated-measures Groups (Recommended)

### Conceptual Approach

**Two-stage grouping:**
```
samples → group by repeated-measures variable →
  treat each repeated-measures group as atomic unit →
  distribute repeated-measures groups to plates (considering treatment balance) →
  within each plate, distribute to rows
```

### Algorithm Flow

```
Current Flow:
samples → group by treatment variables → distribute to plates → distribute to rows

Proposed Flow:
samples → group by repeated-measures variable →
  create repeated-measures groups (atomic units) →
  distribute groups to plates (maintain treatment balance) →
  flatten groups back to samples →
  distribute to rows within each plate
```


### Implementation Details

#### A. Data Structures

```typescript
interface ReplicateGroup {
  replicateId: string;                    // e.g., "Patient_001"
  samples: SearchData[];                  // All samples with this subject ID
  treatmentComposition: Map<string, number>; // Treatment key -> count
  size: number;                           // Number of samples in this group
}

// Example:
// PatientID: 1 has 3 samples:
//   - Sample1: Treatment=Drug, Timepoint=0
//   - Sample2: Treatment=Drug, Timepoint=10
//   - Sample3: Treatment=Drug, Timepoint=20
// treatmentComposition = {
//   "Drug|0": 1,
//   "Drug|10": 1,
//   "Drug|20": 1
// }
```

**Critical Note**: A repeated-measures group can contain samples with DIFFERENT treatment variable values. For example, a patient may have samples at different timepoints or under different treatment conditions. The repeated-measures constraint only requires that all samples from the same subject ID stay on the same plate.

#### B. Pre-processing Phase

```typescript
function createReplicateGroups(
  samples: SearchData[],
  replicateCovariate: string,
  treatmentCovariates: string[]
): ReplicateGroup[] {
  // Group samples by repeated-measures variable
  const replicateMap = new Map<string, SearchData[]>();

  samples.forEach(sample => {
    const replicateId = sample.metadata[replicateCovariate];

    // IMPORTANT: If no subject ID, treat as singleton (unique ID per sample)
    // This ensures samples without subject IDs are NOT grouped together
    // Each singleton can be distributed independently across plates
    const groupId = replicateId || `__singleton_${sample.name}`;

    if (!replicateMap.has(groupId)) {
      replicateMap.set(groupId, []);
    }
    replicateMap.get(groupId)!.push(sample);
  });

  // Create repeated-measures groups with treatment composition
  const replicateGroups: ReplicateGroup[] = [];
  replicateMap.forEach((samples, replicateId) => {
    // Calculate treatment composition for this repeated-measures group
    // A repeated-measures group can contain samples with DIFFERENT treatment values
    const treatmentComposition = new Map<string, number>();
    samples.forEach(sample => {
      const treatmentKey = getCovariateKey(sample, treatmentCovariates);
      treatmentComposition.set(
        treatmentKey,
        (treatmentComposition.get(treatmentKey) || 0) + 1
      );
    });

    replicateGroups.push({
      replicateId,
      samples,
      treatmentComposition,
      size: samples.length
    });
  });

  return replicateGroups;
}
```

**Important Note**: Samples without a subject ID are treated as **singletons** (each forms its own group of size 1). This ensures they can be distributed independently across plates and are not artificially constrained to be together. In real datasets, many samples may not have subject IDs, and they should be treated as independent samples for distribution purposes.


#### C. Distribution Algorithm

**Balanced Best Fit Approach:**

1. **Sort repeated-measures groups** by size (largest first)
2. **For each repeated-measures group**:
   - Calculate the treatment composition of this group (may contain multiple treatment combinations)
   - For each candidate plate, calculate how adding this group would affect treatment balance
   - Check which plates have capacity for this group
   - Assign to plate that best maintains treatment balance AND has capacity
3. **Flatten** repeated-measures groups back to individual samples
4. **Apply row distribution** using existing algorithm

**Key Challenge**: Since a repeated-measures group can contain samples with different treatment combinations, assigning the group to a plate affects the balance of MULTIPLE treatment groups simultaneously. The balancing algorithm must account for the entire composition of each repeated-measures group.

```typescript
function distributeReplicateGroupsToPlates(
  replicateGroups: ReplicateGroup[],
  plateCapacities: number[],
  treatmentCovariates: string[]
): Map<number, ReplicateGroup[]> {

  const plateAssignments = new Map<number, ReplicateGroup[]>();
  const plateCounts = new Array(plateCapacities.length).fill(0);

  // Initialize empty plates
  plateCapacities.forEach((_, plateIdx) => {
    plateAssignments.set(plateIdx, []);
  });

  // Group repeated-measures groups by treatment key
  const treatmentGroups = new Map<string, ReplicateGroup[]>();
  replicateGroups.forEach(rg => {
    if (!treatmentGroups.has(rg.treatmentKey)) {
      treatmentGroups.set(rg.treatmentKey, []);
    }
    treatmentGroups.get(rg.treatmentKey)!.push(rg);
  });

  // Sort each treatment group by size (largest first)
  treatmentGroups.forEach(groups => {
    groups.sort((a, b) => b.size - a.size);
  });

  // Distribute groups using balanced best fit
  treatmentGroups.forEach((groups, treatmentKey) => {
    groups.forEach(replicateGroup => {
      const bestPlate = findBestPlateForGroup(
        replicateGroup,
        plateAssignments,
        plateCounts,
        plateCapacities,
        treatmentKey
      );

      plateAssignments.get(bestPlate)!.push(replicateGroup);
      plateCounts[bestPlate] += replicateGroup.size;
    });
  });

  return plateAssignments;
}
```


#### D. Modified Main Function

```typescript
export function balancedBlockRandomization(
  searches: SearchData[],
  treatmentCovariates: string[],      // Renamed from selectedCovariates
  replicateCovariate?: string,        // NEW: Optional repeated-measures variable
  keepEmptyInLastPlate: boolean = true,
  numRows: number = 8,
  numColumns: number = 12
): {
  plates: (SearchData | undefined)[][][];
  plateAssignments?: Map<number, SearchData[]>;
} {

  if (replicateCovariate) {
    // NEW PATH: Replicate-aware distribution
    return doReplicateAwareRandomization(
      searches,
      treatmentCovariates,
      replicateCovariate,
      keepEmptyInLastPlate,
      numRows,
      numColumns
    );
  } else {
    // EXISTING PATH: Standard distribution
    return doBalancedRandomization(
      searches,
      treatmentCovariates,
      keepEmptyInLastPlate,
      numRows,
      numColumns
    );
  }
}
```

#### E. Validation

```typescript
function validateReplicateAssignments(
  plateAssignments: Map<number, SearchData[]>,
  replicateCovariate: string
): boolean {
  const replicateToPlate = new Map<string, number>();

  plateAssignments.forEach((samples, plateIdx) => {
    samples.forEach(sample => {
      const replicateId = sample.metadata[replicateCovariate];
      if (replicateToPlate.has(replicateId)) {
        if (replicateToPlate.get(replicateId) !== plateIdx) {
          console.error(`Replicate ${replicateId} split across plates!`);
          return false;
        }
      } else {
        replicateToPlate.set(replicateId, plateIdx);
      }
    });
  });

  return true;
}
```

### Advantages
- ✓ Minimally invasive to existing code
- ✓ Handles core requirement (keep replicates together)
- ✓ Maintains approximate treatment balance
- ✓ Can be implemented incrementally
- ✓ Reuses existing row distribution logic

### Disadvantages
- ✗ Treatment balance may not be perfect
- ✗ Greedy algorithm may not find optimal solution
- ✗ Large repeated-measures groups can cause capacity issues


---

## Strategy 2: Constraint-Based Solver

### Conceptual Approach

Define the problem as a **constraint satisfaction problem** with:
1. **Solution space**: All possible assignments of samples to plates/positions
2. **Constraints**: Rules that must/should be satisfied
3. **Objective function**: Score that measures solution quality
4. **Search algorithm**: Find solutions that satisfy constraints and optimize objective

### Core Components

#### A. Solution Representation

```typescript
interface Solution {
  assignments: Map<string, PlatePosition>;  // sampleName -> position
  plateContents: Map<number, SearchData[]>; // plateIdx -> samples
  score: number;                             // Quality score
}

interface PlatePosition {
  plate: number;
  row: number;
  col: number;
}
```

#### B. Constraint Definitions

```typescript
enum ConstraintType {
  HARD = 'hard',  // Must be satisfied (solution invalid if violated)
  SOFT = 'soft'   // Should be satisfied (penalty if violated)
}

interface Constraint {
  type: ConstraintType;
  name: string;
  check: (solution: Solution, samples: SearchData[]) => ConstraintResult;
  weight?: number;  // For soft constraints
}

interface ConstraintResult {
  satisfied: boolean;
  violations: number;
  penalty: number;
  details?: string;
}
```


#### C. Example Constraints

**HARD: Replicates Together**
```typescript
const replicateTogetherConstraint = (replicateCovariate: string): Constraint => ({
  type: ConstraintType.HARD,
  name: 'REPLICATE_TOGETHER',
  check: (solution, samples) => {
    const replicateToPlate = new Map<string, number>();
    let violations = 0;

    solution.assignments.forEach((position, sampleName) => {
      const sample = samples.find(s => s.name === sampleName)!;
      const replicateId = sample.metadata[replicateCovariate];

      if (replicateToPlate.has(replicateId)) {
        if (replicateToPlate.get(replicateId) !== position.plate) {
          violations++;
        }
      } else {
        replicateToPlate.set(replicateId, position.plate);
      }
    });

    return {
      satisfied: violations === 0,
      violations,
      penalty: violations * 1000,
      details: violations > 0 ? `${violations} repeated-measures groups split` : undefined
    };
  }
});
```

**HARD: Plate Capacity**
```typescript
const plateCapacityConstraint = (plateCapacities: number[]): Constraint => ({
  type: ConstraintType.HARD,
  name: 'PLATE_CAPACITY',
  check: (solution) => {
    let violations = 0;
    let totalOverflow = 0;

    solution.plateContents.forEach((samples, plateIdx) => {
      const capacity = plateCapacities[plateIdx];
      if (samples.length > capacity) {
        violations++;
        totalOverflow += samples.length - capacity;
      }
    });

    return {
      satisfied: violations === 0,
      violations,
      penalty: totalOverflow * 1000
    };
  }
});
```

**SOFT: Treatment Balance**
```typescript
const treatmentBalanceConstraint = (
  treatmentCovariates: string[],
  weight: number = 100
): Constraint => ({
  type: ConstraintType.SOFT,
  name: 'TREATMENT_BALANCE',
  weight,
  check: (solution, samples) => {
    const treatmentGroups = groupByCovariates(samples, treatmentCovariates);
    const totalSamples = samples.length;
    let totalDeviation = 0;

    solution.plateContents.forEach((plateSamples) => {
      const plateSize = plateSamples.length;
      const plateGroups = groupByCovariates(plateSamples, treatmentCovariates);

      treatmentGroups.forEach((groupSamples, groupKey) => {
        const expectedProportion = groupSamples.length / totalSamples;
        const expectedCount = expectedProportion * plateSize;
        const actualCount = plateGroups.get(groupKey)?.length || 0;
        totalDeviation += Math.abs(actualCount - expectedCount);
      });
    });

    return {
      satisfied: totalDeviation < 5,
      violations: Math.floor(totalDeviation),
      penalty: totalDeviation * weight
    };
  }
});
```


#### D. Solver Algorithms

**Option 1: Greedy Construction + Local Search**

```typescript
function solveWithConstraints(
  samples: SearchData[],
  constraints: Constraint[],
  config: SolverConfig
): Solution {
  // Phase 1: Construct initial solution greedily
  let solution = constructInitialSolution(samples, constraints, config);

  // Phase 2: Improve through local search
  solution = improveWithLocalSearch(solution, samples, constraints, config);

  return solution;
}
```

**Greedy Construction:**
1. If repeated-measures constraint exists, group samples by subject ID
2. Sort repeated-measures groups by size (largest first)
3. For each group, find best plate that:
   - Has enough capacity
   - Maintains best treatment balance
4. Assign group to that plate

**Local Search:**
1. Generate neighbor solutions (moves):
   - Move repeated-measures group to different plate
   - Shuffle samples within plate (changes rows)
2. Evaluate each neighbor
3. Accept best improvement
4. Repeat until no improvement found

**Option 2: Simulated Annealing**

```typescript
function solveWithSimulatedAnnealing(
  samples: SearchData[],
  constraints: Constraint[],
  config: SolverConfig
): Solution {
  let current = constructInitialSolution(samples, constraints, config);
  let best = current;
  let temperature = 1000;
  const coolingRate = 0.995;

  while (temperature > 1) {
    const neighbor = generateRandomNeighbor(current, samples, config);
    const delta = evaluate(neighbor) - evaluate(current);

    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      current = neighbor;
      if (evaluate(current) > evaluate(best)) {
        best = current;
      }
    }

    temperature *= coolingRate;
  }

  return best;
}
```


#### E. Solution Evaluation

```typescript
function evaluateSolution(
  solution: Solution,
  samples: SearchData[],
  constraints: Constraint[]
): number {
  let totalScore = 0;
  let hardConstraintViolated = false;

  constraints.forEach(constraint => {
    const result = constraint.check(solution, samples);

    if (constraint.type === ConstraintType.HARD && !result.satisfied) {
      hardConstraintViolated = true;
    }

    totalScore -= result.penalty;
  });

  // Hard constraint violation = invalid solution
  if (hardConstraintViolated) {
    return -1000000;
  }

  return totalScore;
}
```

### Advantages
- ✓ Very flexible - easy to add new constraints
- ✓ Clear separation of concerns
- ✓ Transparent - constraints are explicit
- ✓ Tuneable - adjust weights to prioritize goals
- ✓ Can handle complex scenarios

### Disadvantages
- ✗ More complex to implement
- ✗ May be slower than specialized algorithms
- ✗ No optimality guarantees (heuristic)
- ✗ Requires parameter tuning
- ✗ More code to maintain

---

## Strategy 3: Hybrid Approach (Recommended Alternative)

### Conceptual Approach

Combine the best of both strategies:
1. Use **constraint framework** for clarity and flexibility
2. Use **specialized construction** for efficiency
3. Use **constraint-based validation** for correctness

### Implementation

```typescript
function hybridSolver(
  samples: SearchData[],
  constraints: Constraint[],
  config: SolverConfig
): Solution {
  // Use Strategy 1 for initial construction
  const initialSolution = constructWithBalancedAlgorithm(samples, config);

  // Validate with constraints
  const validation = validateWithConstraints(initialSolution, samples, constraints);

  if (!validation.allHardConstraintsSatisfied) {
    throw new Error('Hard constraints violated: ' + validation.details);
  }

  // Optional: Improve with local search if soft constraints not satisfied
  if (validation.softConstraintScore < threshold) {
    return improveWithConstraints(initialSolution, samples, constraints, config);
  }

  return initialSolution;
}
```

### Advantages
- ✓ Fast initial construction
- ✓ Clear constraint definitions
- ✓ Flexible for future extensions
- ✓ Good balance of simplicity and power


---

## Implementation Roadmap

### Phase 1: Core repeated-measures grouping (Week 1)
- [ ] Define `ReplicateGroup` interface
- [ ] Implement `createReplicateGroups()`
- [ ] Add validation for repeated-measures group sizes
- [ ] Unit tests for grouping logic

### Phase 2: Simple Distribution (Week 2)
- [ ] Implement First Fit Decreasing bin packing
- [ ] Distribute repeated-measures groups to plates (no treatment balancing)
- [ ] Validate replicates stay together
- [ ] Integration tests

### Phase 3: Treatment Balancing (Week 3)
- [ ] Implement Balanced Best Fit algorithm
- [ ] Calculate and track treatment balance metrics
- [ ] Add treatment balance validation
- [ ] Performance testing

### Phase 4: UI Integration (Week 4)
- [ ] Add repeated-measures variable selector to UI
- [ ] Validation: prevent overlap with treatment variables
- [ ] Display repeated-measures groups in summary panel
- [ ] Update quality metrics to show replicate info
- [ ] User documentation

### Phase 5: Optimization (Optional)
- [ ] Implement local search improvement
- [ ] Add constraint framework for validation
- [ ] Performance profiling and optimization
- [ ] Advanced quality metrics

---

## Key Considerations

### Treatment Balance vs. repeated-measures constraint

**Trade-off**: Perfect treatment balance may be impossible if repeated-measures groups are unevenly distributed across treatment groups.

**Strategy**: Use "best effort" balancing
- Calculate target proportions for each treatment group per plate
- Assign repeated-measures groups to minimize deviation from targets
- Accept that perfect balance may not be achievable
- Report balance metrics to user

### Bin Packing Problem

Distributing variable-sized repeated-measures groups to fixed-capacity plates is **NP-hard**.

**Practical Approaches**:
1. **First Fit Decreasing**: Sort by size, assign to first plate with capacity
2. **Best Fit**: Assign to plate that minimizes remaining capacity
3. **Balanced Best Fit**: Assign to plate that best maintains treatment balance AND has capacity

### Edge Cases to Handle

1. **repeated-measures group larger than plate**: Error - cannot fit
2. **All samples in one repeated-measures group**: Trivial - all on one plate
3. **Uneven treatment distribution in replicates**: Accept imperfect balance
4. **Mixed replicate sizes**: Sort and pack largest first
5. **Partial plates**: Adjust capacity calculations
6. **Samples without subject ID**: Treat as singletons (size 1 groups)
   - Each sample without a subject ID gets a unique group ID
   - These singletons can be distributed independently
   - Common in real datasets where not all samples have replicates


---

## UI/UX Considerations

### Configuration Interface

```
┌─────────────────────────────────────┐
│ treatment variables                │
│ ☑ Gender                            │
│ ☑ Age_Group                         │
│ ☐ PatientID                         │
│ ☐ Batch                             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ repeated-measures variable (Optional)      │
│ ○ None                              │
│ ● PatientID                         │
│   (Samples with same PatientID      │
│    will be on the same plate)       │
└─────────────────────────────────────┘
```

### Validation Messages

- ✗ "PatientID cannot be both a treatment and repeated-measures variable"
- ✗ "repeated-measures group 'Patient_042' has 120 samples, exceeds plate capacity of 96"
- ⚠ "Treatment balance may be imperfect due to repeated-measures constraints"

### Quality Metrics Display

```
Plate 1 (96 samples)
  Treatment Balance: 85/100
  repeated-measures groups: 8
    - Patient_001: 12 samples
    - Patient_003: 15 samples
    - ...
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('createReplicateGroups', () => {
  it('should group samples by repeated-measures variable', () => {
    // Test basic grouping
  });

  it('should assign treatment key to each group', () => {
    // Test treatment key assignment
  });

  it('should handle missing replicate values', () => {
    // Test error handling
  });
});

describe('distributeReplicateGroupsToPlates', () => {
  it('should keep repeated-measures groups together', () => {
    // Validate constraint
  });

  it('should respect plate capacities', () => {
    // Validate capacity constraint
  });

  it('should maintain approximate treatment balance', () => {
    // Check balance metrics
  });
});
```

### Integration Tests

```typescript
describe('replicate-aware randomization', () => {
  it('should handle simple case with equal repeated-measures groups', () => {
    // 96 samples, 8 patients, 12 samples each
  });

  it('should handle uneven repeated-measures groups', () => {
    // Variable group sizes
  });

  it('should handle multiple plates', () => {
    // 288 samples across 3 plates
  });

  it('should reject oversized repeated-measures groups', () => {
    // Group larger than plate capacity
  });
});
```

### Performance Tests

- Benchmark with 1000+ samples
- Test with 50+ repeated-measures groups
- Measure time for different strategies
- Profile memory usage

---

## Comparison Matrix

| Aspect | Strategy 1: Weighted Groups | Strategy 2: Constraint Solver | Strategy 3: Hybrid |
|--------|----------------------------|-------------------------------|-------------------|
| **Complexity** | Low | High | Medium |
| **Performance** | Fast | Slower | Fast |
| **Flexibility** | Medium | Very High | High |
| **Optimality** | Good | Better | Good |
| **Maintainability** | Good | Medium | Good |
| **Time to Implement** | 2-3 weeks | 4-6 weeks | 3-4 weeks |
| **Extensibility** | Medium | Very High | High |
| **Code Reuse** | High | Low | High |

---

## Recommendation

**Start with Strategy 1 (Weighted repeated-measures groups)** because:
1. Fastest to implement (2-3 weeks)
2. Solves core requirement (keep replicates together)
3. Maintains good treatment balance
4. Minimal changes to existing code
5. Can add optimization later if needed

**Consider Strategy 3 (Hybrid)** if:
- You anticipate many future constraint types
- You want explicit constraint validation
- You need detailed quality reporting

**Avoid Strategy 2 (Pure Constraint Solver)** unless:
- You have very complex requirements
- You need provably optimal solutions
- You have time for extensive development and tuning

---

## Next Steps

1. **Review this document** with team
2. **Choose strategy** based on requirements and timeline
3. **Create detailed design** for chosen strategy
4. **Implement Phase 1** (core grouping logic)
5. **Iterate** based on testing and feedback

---

## References

- Current algorithm: `src/algorithms/balancedRandomization.ts`
- Algorithm documentation: `docs/balanced-randomization-algorithm.md`
- Bin packing algorithms: [Wikipedia](https://en.wikipedia.org/wiki/Bin_packing_problem)
- Constraint satisfaction: [Wikipedia](https://en.wikipedia.org/wiki/Constraint_satisfaction_problem)


### Example: Treatment Composition in repeated-measures groups

**Scenario**: Longitudinal study with treatment and timepoint covariates

```
Patient_001 (4 samples):
  - Sample_A: Treatment=Drug, Timepoint=0
  - Sample_B: Treatment=Drug, Timepoint=10
  - Sample_C: Treatment=Drug, Timepoint=20
  - Sample_D: Treatment=Drug, Timepoint=30

  treatmentComposition = {
    "Drug|0": 1,
    "Drug|10": 1,
    "Drug|20": 1,
    "Drug|30": 1
  }

Patient_002 (4 samples):
  - Sample_E: Treatment=Placebo, Timepoint=0
  - Sample_F: Treatment=Placebo, Timepoint=10
  - Sample_G: Treatment=Placebo, Timepoint=20
  - Sample_H: Treatment=Placebo, Timepoint=30

  treatmentComposition = {
    "Placebo|0": 1,
    "Placebo|10": 1,
    "Placebo|20": 1,
    "Placebo|30": 1
  }
```

**Implication for Balancing**:
- Assigning Patient_001 to Plate 1 adds 1 sample to EACH of 4 different treatment combinations
- Cannot simply track "how many Drug samples" - must track each Drug×Timepoint combination
- Treatment balance calculation must consider the full composition of each repeated-measures group



### Modified Distribution Algorithm

```typescript
function findBestPlateForReplicateGroup(
  replicateGroup: ReplicateGroup,
  plateAssignments: Map<number, ReplicateGroup[]>,
  plateCounts: number[],
  plateCapacities: number[],
  globalTreatmentCounts: Map<string, number>,
  totalSamples: number
): number {

  let bestPlate = -1;
  let bestScore = Infinity;

  plateCapacities.forEach((capacity, plateIdx) => {
    // Check if group fits
    if (plateCounts[plateIdx] + replicateGroup.size > capacity) {
      return; // Skip this plate
    }

    // Calculate current treatment composition on this plate
    const currentPlateComposition = new Map<string, number>();
    plateAssignments.get(plateIdx)!.forEach(rg => {
      rg.treatmentComposition.forEach((count, treatmentKey) => {
        currentPlateComposition.set(
          treatmentKey,
          (currentPlateComposition.get(treatmentKey) || 0) + count
        );
      });
    });

    // Calculate hypothetical composition if we add this group
    const hypotheticalComposition = new Map(currentPlateComposition);
    replicateGroup.treatmentComposition.forEach((count, treatmentKey) => {
      hypotheticalComposition.set(
        treatmentKey,
        (hypotheticalComposition.get(treatmentKey) || 0) + count
      );
    });

    // Calculate deviation from expected proportions
    const hypotheticalPlateSize = plateCounts[plateIdx] + replicateGroup.size;
    let totalDeviation = 0;

    globalTreatmentCounts.forEach((globalCount, treatmentKey) => {
      const expectedProportion = globalCount / totalSamples;
      const expectedCount = expectedProportion * hypotheticalPlateSize;
      const actualCount = hypotheticalComposition.get(treatmentKey) || 0;
      totalDeviation += Math.abs(actualCount - expectedCount);
    });

    // Lower deviation = better balance
    if (totalDeviation < bestScore) {
      bestScore = totalDeviation;
      bestPlate = plateIdx;
    }
  });

  return bestPlate;
}
```

**Key Points**:
- Must calculate treatment composition for entire plate (sum of all repeated-measures groups)
- Must consider how adding a repeated-measures group affects ALL treatment combinations
- Scoring function calculates total deviation across all treatment groups
- Chooses plate that minimizes deviation (best maintains balance)

