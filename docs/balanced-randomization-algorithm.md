# Balanced Randomization Algorithm

## Overview

The **balanced randomization algorithm** in `balancedRandomization.ts` implements a two-level hierarchical block randomization strategy that ensures balanced distribution of covariate groups across both plates and rows within plates.

## Core Approach

### Two-Level Distribution

1. **Plate Level**: Distributes samples across multiple plates
2. **Row Level**: Within each plate, distributes samples across rows

This hierarchical approach ensures that covariate groups are balanced at both the plate level (to control for plate effects) and the row level (to control for row effects within plates).

## Algorithm Steps

### 1. Initialization & Capacity Planning

- **Group samples** by covariate combinations
- **Calculate number of plates** needed based on total samples and plate size
- **Assign plate capacities** based on `keepEmptyInLastPlate` setting:
  - If `true`: Fills plates sequentially, leaving empty wells only in the last plate
  - If `false`: Distributes empty wells randomly across all plates
- **Calculate expected minimums** per plate for each covariate group based on:
  - Total samples in each group
  - Number of plates
  - Individual plate capacities

### 2. Plate-Level Distribution

Uses the `distributeToBlocks` function with three phases:

#### Phase 1: Proportional Placement
- Places samples proportionally across plates based on expected minimums
- Ensures each plate gets its fair share of each covariate group
- Accounts for variable plate capacities (e.g., partial last plate)
- Formula: `expectedMinimum = floor(groupSize / numPlates) × (plateCapacity / fullPlateCapacity)`

#### Phase 2A: Unplaced Groups
- Handles covariate groups too small for proportional distribution
- Prioritizes plates with most available capacity
- Distributes samples across available plates in descending capacity order

#### Phase 2B: Overflow Groups
- Places remaining samples from larger groups that exceeded proportional allocation
- Uses **capacity-based prioritization**: Prefers full-capacity plates over partial plates
- Ensures overflow samples are distributed to maintain balance

### 3. Row-Level Distribution

For each plate independently:

- **Shuffle plate samples** for initial randomization
- **Re-group samples** by covariates within the plate
- **Calculate row capacities**: Fills rows sequentially (always uses `keepEmptyInLastRow=true`)
- **Calculate expected minimums** per row for each covariate group
- **Apply distribution logic** using the same three-phase approach:
  - Phase 1: Proportional placement across rows
  - Phase 2A: Unplaced groups (prioritizes rows with most capacity)
  - Phase 2B: Overflow groups with **group-balance prioritization**
    - Prefers rows that have fewer samples of the current covariate group
    - Helps prevent clustering of the same group in specific rows

### 4. Final Randomization

- **Shuffle samples within each row** for final well position randomization
- **Place samples** in well positions left to right
- Empty wells remain `undefined`

## Key Features

### Validation

The algorithm includes multiple validation checks:

- **Capacity validation**: Ensures total samples don't exceed total capacity
- **Expected minimums validation**: Verifies expected minimums don't exceed individual plate/row capacities
- **Distribution validation**: Confirms each plate/row meets minimum requirements for each covariate group
- **Error reporting**: Logs detailed error messages when validation fails

### Prioritization Strategies

Three prioritization strategies are used depending on context:

1. **BY_CAPACITY** (Plate-level overflow)
   - Prioritizes higher capacity blocks
   - Prefers full plates over partial plates
   - Ensures overflow samples go to plates with most room

2. **BY_GROUP_BALANCE** (Row-level overflow)
   - Prioritizes blocks with fewer samples of current group
   - Prevents clustering of same group in specific rows
   - Maintains better within-plate balance

3. **NONE**
   - No prioritization
   - All available blocks considered equally
   - Uses random shuffling

### Flexibility

- **Variable plate capacities**: Handles partial plates automatically
- **Configurable dimensions**: Works with any plate size (rows × columns)
- **Multiple covariates**: Supports any number of covariate combinations
- **Empty well distribution**: User-controlled via `keepEmptyInLastPlate` parameter

## Mathematical Foundation

### Expected Minimum Calculation

For each covariate group on each plate:

```
capacityRatio = plateCapacity / fullPlateCapacity
globalExpected = floor(groupSize / numPlates)
expectedMinimum = round(globalExpected × capacityRatio)
```

This ensures that:
- Partial plates get proportionally fewer samples
- Full plates get equal shares
- Total expected minimums don't exceed plate capacity

### Distribution Phases

The three-phase distribution ensures:
1. **Proportional representation** (Phase 1)
2. **Complete coverage** of small groups (Phase 2A)
3. **Balanced overflow** handling (Phase 2B)

## Result Quality

The algorithm produces a balanced randomization where:

- ✓ Each plate has **proportional representation** of all covariate groups
- ✓ Within each plate, **rows are balanced** across covariate groups
- ✓ Final **well positions are randomized** within rows
- ✓ Empty wells are handled according to user preference
- ✓ **Validation ensures** minimum requirements are met at both levels

This ensures high-quality randomization suitable for experimental designs where both plate effects and row effects need to be controlled.

## Example

For a dataset with:
- 288 samples
- 3 covariate groups (A: 96, B: 96, C: 96)
- 96-well plates (8 rows × 12 columns)

The algorithm will:
1. Create 3 full plates
2. Distribute each group evenly: 32 samples per group per plate
3. Within each plate, distribute across 8 rows: ~4 samples per group per row
4. Shuffle samples within each row for final randomization

Result: Perfect balance at both plate and row levels with randomized well positions.

## Code Location

- **Main function**: `balancedBlockRandomization()` in `src/algorithms/balancedRandomization.ts`
- **Core distribution**: `distributeToBlocks()` - handles both plate and row distribution
- **Helper functions**:
  - `calculateExpectedMinimums()` - computes expected sample counts
  - `assignBlockCapacities()` - determines plate/row capacities
  - `placeProportionalSamples()` - Phase 1 distribution
  - `processUnplacedGroups()` - Phase 2A distribution
  - `processOverflowGroups()` - Phase 2B distribution
