# Test Data Files

This directory contains sample CSV files for manual testing of the Octopus Block Randomizer.

## Files

### `simple-metadata.csv`
Basic test file without repeated-measures variables.
- **Samples**: 10
- **Covariates**: age, sex, treatment, batch
- **Use case**: Testing standard randomization without repeated-measures

**How to use:**
1. Start the app: `npm start`
2. Upload this file
3. Select covariates: `sex`, `treatment`
4. Configure plate settings (e.g., 8 rows × 12 columns)
5. Run randomization

---

### `missing-subject-ids-example.csv`
Test file demonstrating how missing and "n/a" subject IDs are handled.
- **Samples**: 10 total
- **Patients**: 3 (P001, P002, P003)
- **Singletons**: 4 samples with missing/n/a PatientIDs
- **Covariates**: PatientID, Treatment, Timepoint, Sex, Age

**Special cases demonstrated:**
- `n/a` (lowercase) - treated as missing
- `N/A` (uppercase) - treated as missing
- Empty string - treated as missing
- Whitespace only - treated as missing

**How to use:**
1. Start the app: `npm start`
2. Upload this file
3. Select `PatientID` as the repeated-measures variable
4. Select `Treatment` as treatment covariate
5. Run randomization

**Expected behavior:**
- 3 patient groups (P001, P002, P003) with 2 samples each
- 4 singleton groups (one for each sample with missing/n/a PatientID)
- **Important:** Singletons are distributed independently across plates (not part of repeated-measures distribution)
- Multi-sample groups will be shown in the "Group Assignments" table with their plate assignments
- Singletons will NOT appear in the table (they're noted separately)
- Total of 7 groups

---

### `repeated-measures-example.csv`
Comprehensive test file for repeated-measures functionality.
- **Samples**: 23 total
- **Patients**: 8 (P001-P008)
- **Group sizes**:
  - 4 patients with 4 timepoints each (16 samples)
  - 2 patients with 3 timepoints each (6 samples)
  - 1 patient with 2 timepoints (2 samples)
  - 1 singleton patient (1 sample)
- **Covariates**: PatientID, Treatment, Timepoint, Sex, Age

**How to use:**
1. Start the app: `npm start`
2. Upload this file
3. **Important**: Select `PatientID` as the repeated-measures variable
4. Select treatment covariates: `Treatment`, `Sex`
5. Configure plate settings (e.g., 8 rows × 12 columns = 96 wells)
6. Run randomization

**Expected behavior:**
- All samples from the same patient (PatientID) should appear on the same plate
- Treatment balance should be maintained across plates
- Singletons (P008) should be distributed independently
- Quality metrics should show "Constraints satisfied: YES"

**Test scenarios:**

1. **Single plate (96 wells)**: All 23 samples fit on one plate
   - All patient groups stay together
   - Good treatment balance

2. **Small plates (24 wells)**: Forces distribution across multiple plates
   - Larger groups (4 samples) go to plates with more capacity
   - Smaller groups fill remaining space
   - Each patient group stays on one plate

3. **Edge case - Tight capacity**: Use 2 plates with 12 wells each (24 total)
   - Tests the greedy best-fit algorithm
   - Some groups may not fit and will show warnings

## Creating Your Own Test Files

Your CSV file should have:
1. A header row with column names
2. One row per sample
3. At least one column for sample identification
4. Covariate columns for balancing

For repeated-measures testing:
- Include a column that identifies which samples belong together (e.g., PatientID, SubjectID)
- Ensure samples from the same subject have the same value in this column
- Include treatment/condition columns for balancing

Example structure:
```csv
SampleName,SubjectID,Treatment,Timepoint
S001_T1,Subject1,DrugA,Day0
S001_T2,Subject1,DrugA,Day7
S002_T1,Subject2,DrugB,Day0
S002_T2,Subject2,DrugB,Day7
```

## Troubleshooting

**Issue**: "Groups are split across plates"
- **Solution**: Increase plate capacity or reduce number of plates

**Issue**: "Poor treatment balance"
- **Solution**: Ensure you have enough samples per treatment group

**Issue**: "Capacity exceeded"
- **Solution**: Increase plate size or number of plates to accommodate all samples
