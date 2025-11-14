# Octopus Block Randomizer

## What is Octopus Block Randomizer?

Octopus Block Randomizer is a web application designed to optimize the distribution of experimental samples across multiple plates (e.g., 96-well plates, microplates). The tool ensures that samples are distributed in a balanced and randomized manner, helping researchers minimize bias and maintain statistical validity in their experiments.

### Key Purposes

**Balanced Distribution**: The app ensures each plate contains a representative mix of sample types based on your selected covariates (such as treatment groups, time points, dose levels, or other experimental factors).

**Spatial Randomization**: Samples are positioned on plates to minimize clustering of similar samples, reducing potential position-based biases.

**Quality Assessment**: Built-in metrics evaluate how well your sample distribution achieves balance and randomization, helping you identify and correct issues before running experiments.

**Flexible Configuration**: Multiple algorithms and customizable plate dimensions allow you to adapt the randomization strategy to your specific experimental needs.

---

## How Octopus Block Randomizer Works

### The Randomization Process

1. **Sample Classification**: Your samples are grouped based on selected covariates (experimental factors like treatment type, time point, etc.)

2. **Proportional Distribution**: Samples are distributed across plates so each plate receives a proportional representation of each covariate group

3. **Spatial Placement**: Within each plate, samples are positioned to minimize clustering and maximize randomization

4. **Quality Evaluation**: Balance and randomization scores are calculated to assess the quality of the distribution

### Available Algorithms

**Balanced Spatial Randomization** (Default, Recommended)
- Distributes samples proportionally across all plates
- Uses intelligent placement to minimize spatial clustering within each plate
- Best for experiments where spatial effects are a concern

**Balanced Block Randomization**
- Distributes samples proportionally across plates and rows
- Shuffles samples within each row for randomization
- Useful when row-level balance is important

**Greedy Algorithm** (Legacy)
- Original algorithm with tolerance-based iterative placement
- Available for compatibility with previous workflows

---

## How to Use Octopus Block Randomizer

### Step 1: Upload Your Data

Prepare a CSV file containing your sample information with:
- A unique identifier column for each sample
- One or more columns representing experimental covariates (factors you want to balance)

Click the upload area or drag your CSV file to begin.

### Step 2: Configure Your Randomization

#### Select ID Column
Choose which column contains your unique sample identifiers. The app will automatically suggest common identifier column names like "_UW_Sample_ID_" or "_search name_".

#### Choose Covariates
Select which experimental factors should be balanced across plates. You can select multiple covariates (e.g., Treatment Group, Time Point, Dose Level). The selected covariates will be displayed below the selection box.

#### Select Repeated-measures Variable (Optional)
Choose a variable to group samples from the same subject that must stay together on the same plate (e.g., PatientID, SubjectID, AnimalID). When selected, all samples sharing the same value for this variable will be assigned to the same plate. This is useful for:
- Biological replicates from the same patient or subject
- Technical replicates that should be processed together
- Time-series measurements from the same individual
- Any samples that must remain together for experimental or logistical reasons

**Important**: A variable cannot be both a treatment variable and a repeated-measures variable. The app will prevent this configuration and display an error if attempted.

When a repeated-measures variable is selected, you'll see a confirmation message: "All samples with the same [VariableName] value will be assigned to the same plate."

#### Set Control/Reference Samples (Optional)
Enter comma-separated labels for control or reference samples (e.g., "Control, QC, Reference"). These groups will receive brighter, priority colors for easy identification.

#### Select Randomization Algorithm
- **Balanced Spatial Randomization**: Default choice for most experiments
- **Balanced Block Randomization**: When row-level balance is important
- **Greedy Algorithm**: Legacy option for existing workflows

#### Configure Plate Dimensions
- **Rows**: Set from 1-16 (default: 8)
- **Columns**: Set from 1-24 (default: 12)
- The total plate capacity (rows × columns) is displayed automatically

#### Choose Empty Cell Distribution
When your sample count doesn't fill all available wells:
- **Keep empty cells in last plate** (default): All empty wells assigned to the final plate
- **Distribute evenly**: Empty wells spread across all plates

### Step 3: Generate Randomized Plates

Click the **"Generate Randomized Plates"** button to create your sample distribution.

### Step 4: Review and Evaluate

#### View Modes

**Compact View** (Default)
- Small cells (18×16 pixels) show all plates simultaneously
- Ideal for visualizing overall distribution patterns
- Hover over cells to see sample details

**Full Size View**
- Large cells (100×60 pixels) display complete information
- Sample names and covariate values visible directly in each well
- Better for detailed inspection

Switch between views using the **"Compact View"** / **"Full Size View"** button.

#### Covariate Summary Panel

Click **"Show/Hide Covariate Summary"** to display:
- All unique covariate groups with color indicators
- Sample counts for each group (sorted from most to least samples)
- Complete covariate values for each group

**Interactive Highlighting**: Click any covariate group in the summary to highlight all samples from that group across all plates (blue glowing border).

#### Quality Metrics

**Overall Quality Button**: Shows experiment-wide quality score and level (Excellent, Good, Fair, Poor, or Bad)

Click the quality button to open the **Quality Assessment Popup** showing:
- Experiment summary with average balance and randomization scores
- Individual scores for each plate

**Plate Headers**: Each plate displays:
- **Bal**: Balance score (0-100) for that plate
- **Rand**: Randomization score (0-100) for that plate

#### Plate Details Popup

Click the **"i"** icon in any plate header to view:
- Plate capacity and sample count
- Quality scores (balance and randomization)
- Detailed breakdown of each covariate group on that plate:
  - Color indicator matching the plate display
  - Sample proportions (plate count / total group count)
  - Expected vs. actual sample counts
  - Deviation percentages
  - Individual balance scores

The popup is draggable and updates in real-time when samples are moved.

### Step 5: Refine Your Randomization (Optional)

#### Global Re-randomization
Click the main **"Re-randomize"** button to generate a completely new distribution for all plates while preserving your configuration settings.

#### Individual Plate Re-randomization
Click the **"R"** button in any plate header to re-randomize only that specific plate. The behavior depends on your selected algorithm:
- **Balanced Spatial**: Re-places samples to minimize clustering
- **Balanced Block**: Shuffles samples within rows
- **Greedy**: Shuffles all samples across the plate

Quality scores update automatically after any re-randomization.

### Step 6: Export Your Results

Once satisfied with the distribution, click **"Export"** or **"Download CSV"** to save your plate assignments. The exported file includes all original sample data plus assigned plate numbers and well positions.

---

## Understanding Quality Scores

### Balance Score (0-100)
Measures how proportionally each covariate group is represented on each plate compared to the overall population. Higher scores indicate better balance.

### Randomization Score (0-100)
Measures spatial clustering by analyzing whether samples from different covariate groups are neighbors. Higher scores indicate better spatial randomization with less clustering.

### Overall Score
The average of balance and randomization scores, calculated at both plate level and experiment level.

### Quality Levels

| Score Range | Quality Level |
|-------------|---------------|
| 90-100 | Excellent |
| 80-89 | Good |
| 70-79 | Fair |
| 60-69 | Poor |
| 0-59 | Bad |

---

## Tips for Best Results

1. **Select Relevant Covariates**: Choose only the experimental factors that matter for your analysis. Too many covariates can make perfect balance difficult to achieve.

2. **Use Control Labels**: Specifying control/reference samples helps you quickly identify these important samples with bright, priority colors.

3. **Start with Default Algorithm**: The Balanced Spatial Randomization algorithm works well for most experimental designs.

4. **Review Quality Scores**: Aim for scores above 80 (Good or Excellent). If scores are low, try global re-randomization or adjust individual plates.

5. **Inspect Distributions**: Use the covariate summary and interactive highlighting to verify that key sample groups are well-distributed across plates.

6. **Use Compact View First**: Start with the compact view to identify any obvious distribution issues, then switch to full size for detailed verification.

7. **Check Plate Details**: For critical experiments, review the plate details popup for each plate to ensure expected counts align with actual counts.

---

## Color Coding

The app uses 24 distinct bright colors to represent different covariate groups. For experiments with more groups:

- **Groups 1-24**: Solid color fill
- **Groups 25-48**: Outline only (transparent fill)
- **Groups 49-72**: Diagonal stripes pattern

This system supports up to 72 unique covariate groups while maintaining visual distinction.

---

## Technical Details

### Quality Score Calculations

#### Balance Score
For each covariate group on each plate, the balance score evaluates how closely the actual sample distribution matches the expected proportional distribution:

```
Actual Proportion = Actual Count / Plate Capacity
Expected Proportion = Group Size / Total Samples
Relative Deviation = |Actual Proportion - Expected Proportion| / Expected Proportion
Balance Score = max(0, 100 - (Relative Deviation × 100))
```

The overall plate balance uses weighted averaging based on covariate group sizes.

#### Randomization Score
The randomization score analyzes spatial neighbor relationships (8-directional: up, down, left, right, and diagonals) to detect clustering:

```
For each sample position:
  Count neighbors from different covariate groups
  Calculate ratio = Different Neighbors / Total Neighbor Comparisons

Randomization Score = (Total Different Neighbors / Total Comparisons) × 100
```

#### Overall Scores
- **Plate Overall Score** = (Balance Score + Randomization Score) / 2
- **Experiment Scores** = Average of all plate scores

---

## Frequently Asked Questions

**Q: How many samples can the app handle?**
A: The app can handle large datasets. The number of plates generated depends on your sample count and plate dimensions.

**Q: What file format is required?**
A: CSV (Comma-Separated Values) format with headers in the first row.

**Q: Can I save and reload my configuration?**
A: The exported CSV includes plate assignments. To use the same configuration again, keep note of your settings and reupload the original CSV.

**Q: What if my quality scores are low?**
A: Try the global re-randomization button multiple times to generate different distributions. You can also re-randomize individual problematic plates using the "R" button.

**Q: How do I choose between algorithms?**
A: Start with Balanced Spatial Randomization (default) for most cases. Use Balanced Block Randomization if row-level balance is specifically important for your experimental design.

**Q: Can I manually move samples between plates?**
A: The current version focuses on algorithmic optimization. Use the re-randomization features to generate alternative distributions.

---

## Working with Repeated-measures Variables

### What are Repeated-measures Variables?

A repeated-measures variable (also called a replicate covariate or subject identifier) is a metadata field that identifies samples from the same subject, patient, or experimental unit that must be kept together on the same plate. This feature ensures that related samples are processed together, which is critical for many experimental designs.

### When to Use Repeated-measures Variables

Use repeated-measures variables when you have:

**Longitudinal Studies**
- Multiple time points from the same patient or subject
- Example: Patient_001 has samples at T0, T1, T2, and T3
- All four samples must be on the same plate to minimize batch effects

**Biological Replicates**
- Multiple samples from the same biological source
- Example: Three tissue samples from the same mouse
- Keeping replicates together reduces technical variation

**Technical Replicates**
- Duplicate or triplicate measurements of the same sample
- Example: Sample_A measured three times for quality control
- Processing together ensures consistent conditions

**Paired Samples**
- Before/after treatment samples from the same subject
- Example: Pre-treatment and post-treatment biopsies from Patient_042
- Pairing on the same plate enables direct comparison

**Hierarchical Designs**
- Nested experimental structures
- Example: Multiple wells from the same culture dish
- Maintaining hierarchy reduces confounding factors

### How Repeated-measures Variables Work

When you select a repeated-measures variable:

1. **Grouping**: The app groups all samples with the same value (e.g., all samples with PatientID = "Patient_001")

2. **Constraint**: Each group is assigned to a single plate as an atomic unit - groups are never split across plates

3. **Balance**: The app still attempts to balance treatment variables across plates, but respects the repeated-measures constraint

4. **Distribution**: Groups are distributed using a smart algorithm that:
   - Assigns larger groups first to optimize space usage
   - Selects plates that maintain the best treatment balance
   - Respects plate capacity limits

5. **Singletons**: Samples without a repeated-measures value are treated as independent units and distributed normally

### Configuration Guidelines

#### Choosing the Right Variable

**Good Repeated-measures Variables:**
- PatientID, SubjectID, AnimalID
- DonorID, CellLineID, CultureID
- BatchID (for samples processed together)
- Any identifier that groups related samples

**Poor Repeated-measures Variables:**
- Treatment groups (use as treatment variables instead)
- Time points (use as treatment variables instead)
- Categorical factors with many samples per category
- Variables with mostly unique values (creates too many singletons)

#### Variable Mutual Exclusivity

A variable cannot be both a treatment variable and a repeated-measures variable. This prevents logical conflicts:

**Incorrect Configuration:**
- Treatment Variables: Treatment, Timepoint
- Repeated-measures Variable: Timepoint ❌

**Correct Configuration:**
- Treatment Variables: Treatment, Timepoint
- Repeated-measures Variable: PatientID ✓

The app will display an error and prevent randomization if you attempt to use the same variable for both purposes.

#### Group Size Considerations

**Optimal Group Sizes:**
- Small to medium groups (2-10 samples) work best
- Allow flexibility for balancing across plates
- Minimize wasted plate space

**Large Groups:**
- Groups using >50% of plate capacity will trigger a warning
- May limit balancing flexibility
- Consider using larger plates if possible

**Oversized Groups:**
- Groups exceeding plate capacity will cause an error
- Must increase plate dimensions or split the group manually
- The app will identify problematic groups by name

**High Singleton Ratio:**
- If >80% of groups are singletons (single samples), you'll see a warning
- May indicate incorrect variable selection
- Verify you've chosen the right repeated-measures variable

### Validation and Error Messages

The app validates your repeated-measures configuration and provides helpful feedback:

#### Error Messages (Block Randomization)

**Oversized Group Error**
```
Repeated-measures group 'Patient_042' has 120 samples, which exceeds
plate capacity of 96. Please increase plate size or split this group.
```
**Solution**: Increase rows/columns or manually split the group in your data

**Variable Conflict Error**
```
A variable cannot be both a treatment variable and a repeated-measures
variable. Please select different variables.
```
**Solution**: Remove the variable from either treatment or repeated-measures selection

#### Warning Messages (Allow Randomization)

**Large Group Warning**
```
Repeated-measures group 'Patient_015' has 60 samples (62% of plate
capacity). Large groups may limit balancing flexibility.
```
**Impact**: Randomization will proceed but balance may be suboptimal

**High Singleton Ratio Warning**
```
High proportion of singleton groups (85%). Consider verifying that
'SampleID' is the correct variable for grouping.
```
**Impact**: May indicate you selected a unique identifier instead of a grouping variable

**Imperfect Balance Warning**
```
Treatment balance may not be perfect due to repeated-measures
constraints. Balance score: 78/100
```
**Impact**: This is expected - perfect balance is often impossible with repeated-measures constraints

### Understanding Quality Metrics

When using repeated-measures variables, the summary panel displays additional metrics:

**Repeated-measures Groups Section:**
- Total groups: Total number of subject groups created
- Multi-sample groups: Groups with 2+ samples
- Singleton groups: Samples without a repeated-measures value
- Largest group: The biggest group and its size

**Treatment Balance:**
- Balance score: 0-100, higher is better
- Status: Good (80+), Fair (70-79), or Poor (<70)

**Per-Plate Information:**
- Number of repeated-measures groups on each plate
- Treatment distribution compared to expected values

### Best Practices

#### 1. Plan Your Plate Capacity

Calculate total samples and group sizes before randomization:
- If you have 10 patients with 8 samples each (80 total), one 96-well plate works
- If you have 20 patients with 12 samples each (240 total), you need at least 3 plates

#### 2. Balance Group Sizes

Try to keep group sizes relatively uniform:
- Uneven groups (e.g., 2, 2, 3, 45, 2) make balancing difficult
- Even groups (e.g., 8, 8, 8, 8, 8) allow better distribution

#### 3. Accept Imperfect Balance

With repeated-measures constraints, perfect treatment balance is often impossible:
- Balance scores of 75-85 are typical and acceptable
- Focus on keeping groups together rather than perfect balance
- The algorithm does its best within the constraints

#### 4. Use Appropriate Plate Sizes

Choose plate dimensions that accommodate your largest groups:
- If largest group is 20 samples, use at least 48-well plates (6×8)
- Leave some buffer space for balancing flexibility
- Larger plates generally allow better balance

#### 5. Verify Your Configuration

Before randomizing large experiments:
- Check that the repeated-measures variable is correct
- Review validation warnings carefully
- Test with a small subset of data first

#### 6. Review Group Assignments

After randomization:
- Check the repeated-measures groups section in the summary
- Verify that groups are distributed as expected
- Use the plate details popup to inspect individual plates

### Troubleshooting Guide

#### Problem: "Oversized group" error

**Symptoms**: Error message identifying groups that exceed plate capacity

**Solutions**:
1. Increase plate dimensions (more rows or columns)
2. Split large groups manually in your CSV file
3. Use multiple repeated-measures variables if you have hierarchical grouping
4. Consider whether all samples in the group truly need to be together

#### Problem: Low balance scores (<70)

**Symptoms**: Treatment balance score is lower than desired

**Causes**:
- Very uneven group sizes
- Large groups consuming most of a plate
- High number of treatment combinations relative to plate count

**Solutions**:
1. Try re-randomization multiple times to find better distributions
2. Increase the number of plates (use smaller plate dimensions)
3. Reduce the number of treatment variables if possible
4. Accept that some imbalance is unavoidable with repeated-measures constraints

#### Problem: High singleton ratio warning

**Symptoms**: Warning that >80% of groups are singletons

**Causes**:
- Selected a unique identifier (e.g., SampleID) instead of a grouping variable
- Most samples genuinely don't have related samples
- Incorrect or missing data in the repeated-measures column

**Solutions**:
1. Verify you selected the correct variable (should group related samples)
2. Check your CSV file for missing or incorrect values
3. If most samples are truly independent, consider not using a repeated-measures variable

#### Problem: Groups split across plates

**Symptoms**: Samples from the same subject appear on different plates

**Causes**:
- This should never happen - it indicates a bug

**Solutions**:
1. Check the console for error messages
2. Verify your data doesn't have duplicate subject IDs with different spellings
3. Report the issue with your dataset for investigation

#### Problem: Empty plates or uneven distribution

**Symptoms**: Some plates are nearly empty while others are full

**Causes**:
- Large groups consuming entire plates
- Insufficient total capacity for balanced distribution

**Solutions**:
1. Increase the number of plates (reduce plate dimensions)
2. Use larger plates to accommodate big groups with room for others
3. Review group sizes and consider splitting very large groups

#### Problem: Cannot select repeated-measures variable

**Symptoms**: Variable is grayed out or shows error when selected

**Causes**:
- Variable is already selected as a treatment variable
- Variable has no data or all missing values

**Solutions**:
1. Remove the variable from treatment variables first
2. Check your CSV file to ensure the column has valid data
3. Verify the column name matches exactly (case-sensitive)

### Examples

#### Example 1: Longitudinal Patient Study

**Scenario**: 12 patients, 4 time points each (48 samples total), 2 treatment groups

**Configuration**:
- ID Column: SampleID
- Treatment Variables: Treatment, Timepoint
- Repeated-measures Variable: PatientID
- Plate Size: 8 rows × 12 columns (96 wells)

**Result**: All 48 samples fit on one plate, with each patient's 4 samples kept together

#### Example 2: Multi-site Clinical Trial

**Scenario**: 96 patients, 3 samples each (288 samples), 4 treatment groups

**Configuration**:
- ID Column: SampleID
- Treatment Variables: Treatment, Site
- Repeated-measures Variable: PatientID
- Plate Size: 8 rows × 12 columns (96 wells)

**Result**: 3 plates, each patient's 3 samples on the same plate, treatments balanced across plates

#### Example 3: Technical Replicates

**Scenario**: 32 samples, 3 technical replicates each (96 samples), 2 conditions

**Configuration**:
- ID Column: ReplicateID
- Treatment Variables: Condition
- Repeated-measures Variable: OriginalSampleID
- Plate Size: 8 rows × 12 columns (96 wells)

**Result**: 1 plate, all replicates from each original sample kept together

### Limitations

**Current Limitations**:
1. Only one repeated-measures variable can be selected at a time
2. Groups cannot be manually adjusted after creation
3. No hierarchical grouping (e.g., Patient > Sample > Replicate)
4. No spatial constraints within plates for repeated-measures groups
5. Balance optimization uses a greedy algorithm (not exhaustive search)

**Future Enhancements** (Planned):
- Multiple repeated-measures levels for hierarchical designs
- Manual group editing and splitting
- Advanced optimization algorithms for better balance
- Spatial constraints for group placement within plates
- Visual highlighting of repeated-measures groups in plate view

### Performance Notes

The repeated-measures feature is optimized for typical experimental scales:
- **Small datasets** (<100 samples): Instant (<100ms)
- **Medium datasets** (100-1000 samples): Very fast (<1 second)
- **Large datasets** (1000-5000 samples): Fast (<5 seconds)

For very large datasets (>5000 samples), randomization may take longer but should complete within reasonable time.

---

## Support

For additional help, feature requests, or bug reports, please contact your application administrator or refer to your organization's support documentation.