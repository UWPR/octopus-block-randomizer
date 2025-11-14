# Repeated-measures Variables - Quick Reference Guide

## What is a Repeated-measures Variable?

A repeated-measures variable is a metadata field that identifies samples from the same subject, patient, or experimental unit that must be kept together on the same plate.

**Common Examples**: PatientID, SubjectID, AnimalID, DonorID, CellLineID

## When to Use

✅ **Use repeated-measures variables when you have:**
- Multiple time points from the same patient/subject
- Biological replicates from the same source
- Technical replicates that should be processed together
- Before/after treatment samples from the same subject
- Nested experimental structures (e.g., multiple wells from same culture)

❌ **Don't use repeated-measures variables for:**
- Treatment groups (use as treatment variables instead)
- Time points as a factor (use as treatment variables instead)
- Variables with mostly unique values (creates too many singletons)

## Quick Setup

1. **Upload your CSV** with sample data
2. **Select ID column** for unique sample identifiers
3. **Choose treatment variables** for balancing (e.g., Treatment, Timepoint)
4. **Select repeated-measures variable** (e.g., PatientID)
5. **Configure plate dimensions** to accommodate your largest group
6. **Generate randomized plates**

## Important Rules

### Variable Mutual Exclusivity
- A variable **cannot** be both a treatment variable AND a repeated-measures variable
- The app will show an error if you try this

### Group Size Limits
- Groups **must not exceed** plate capacity (rows × columns)
- Groups **>50% of plate capacity** will trigger a warning
- Plan your plate size to accommodate your largest group

### Singletons
- Samples without a repeated-measures value are treated as independent units
- High singleton ratio (>80%) may indicate wrong variable selection

## Common Configurations

### Longitudinal Study
```
Scenario: 12 patients, 4 time points each
Treatment Variables: Treatment, Timepoint
Repeated-measures Variable: PatientID
Plate Size: 8×12 (96 wells)
Result: 1 plate, all timepoints per patient together
```

### Multi-site Trial
```
Scenario: 96 patients, 3 samples each
Treatment Variables: Treatment, Site
Repeated-measures Variable: PatientID
Plate Size: 8×12 (96 wells)
Result: 3 plates, each patient's samples together
```

### Technical Replicates
```
Scenario: 32 samples, 3 replicates each
Treatment Variables: Condition
Repeated-measures Variable: OriginalSampleID
Plate Size: 8×12 (96 wells)
Result: 1 plate, all replicates together
```

## Validation Messages

### Errors (Block Randomization)

**Oversized Group**
```
Repeated-measures group 'Patient_042' has 120 samples, which exceeds
plate capacity of 96.
```
**Fix**: Increase plate size or split the group

**Variable Conflict**
```
A variable cannot be both a treatment variable and a repeated-measures variable.
```
**Fix**: Remove variable from one of the selections

### Warnings (Allow Randomization)

**Large Group**
```
Repeated-measures group 'Patient_015' has 60 samples (62% of plate capacity).
```
**Impact**: May limit balancing flexibility, but randomization proceeds

**High Singleton Ratio**
```
High proportion of singleton groups (85%).
```
**Impact**: May indicate wrong variable selected

**Imperfect Balance**
```
Treatment balance may not be perfect due to repeated-measures constraints.
```
**Impact**: Expected behavior - perfect balance often impossible

## Quality Metrics

After randomization, check the summary panel for:

- **Total groups**: Number of subject groups created
- **Multi-sample groups**: Groups with 2+ samples
- **Singleton groups**: Independent samples
- **Largest group**: Biggest group size
- **Balance score**: 0-100 (higher is better)
  - 80-100: Good/Excellent
  - 70-79: Fair
  - <70: Poor (but may be unavoidable)

## Troubleshooting

### Problem: Oversized group error
**Solution**: Increase plate dimensions or split the group manually in your CSV

### Problem: Low balance scores (<70)
**Solutions**:
- Try re-randomization multiple times
- Increase number of plates (use smaller dimensions)
- Accept that some imbalance is unavoidable with repeated-measures constraints

### Problem: High singleton ratio warning
**Solutions**:
- Verify you selected the correct grouping variable
- Check CSV for missing/incorrect values
- If samples are truly independent, don't use repeated-measures variable

### Problem: Cannot select variable
**Solutions**:
- Remove variable from treatment variables first
- Check CSV file has valid data in that column
- Verify column name matches exactly (case-sensitive)

## Best Practices

1. **Plan plate capacity**: Calculate total samples and group sizes beforehand
2. **Balance group sizes**: Try to keep groups relatively uniform
3. **Accept imperfect balance**: Scores of 75-85 are typical and acceptable
4. **Use appropriate plate sizes**: Leave buffer space for balancing flexibility
5. **Verify configuration**: Check warnings carefully before randomizing
6. **Test first**: Try with a small subset before full experiment

## Performance

- Small datasets (<100 samples): Instant
- Medium datasets (100-1000 samples): <1 second
- Large datasets (1000-5000 samples): <5 seconds

## Limitations

- Only one repeated-measures variable at a time
- No hierarchical grouping (e.g., Patient > Sample > Replicate)
- Groups cannot be manually edited after creation
- Balance uses greedy algorithm (not exhaustive search)

## Need More Help?

See the [complete user guide](octopus_doc.md#working-with-repeated-measures-variables) for detailed information, examples, and troubleshooting.
