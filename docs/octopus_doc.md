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

#### Set QC/Reference Samples (Optional)
Enter comma-separated labels for QC or reference samples (e.g., "QC, Reference"). These groups will receive darker colors for easy identification.

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

2. **Use QC / Reference Labels**: Specifying QC/reference samples helps you quickly identify these important samples with darker colors.

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

## Support

For additional help, feature requests, or bug reports, please contact your application administrator or refer to your organization's support documentation.