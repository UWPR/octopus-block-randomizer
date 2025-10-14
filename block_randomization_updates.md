# Octopus Block Randomization - Feature Updates

## Overview

This document describes the enhancements made to the Octopus Block Randomization app for distributing samples across plates.


## 1. Updated Color Palette

- **Palette Size**: Expanded to 24 distinct, bright colors organized into 4 subgroups for better visual separation
- **Color Assignment Strategy**: Colors are assigned based on sample counts (descending order), with priority given to control/reference samples

- **Handling Large Numbers of Covariate Groups**: When the number of unique covariate groups exceeds 24, the colors are recycled, and the following approach is used for display:

|  |  |
|-------------|---------------|
| Groups 1-24 | **Solid fill** with the assigned color |
| Groups 25-48 | **Outline only** using the assigned color (transparent fill) |
| Groups 49-72 | **Diagonal stripes** pattern using the assigned color |

This approach supports up to 72 unique covariate groups.

---

## 2. Updated Configuration Form

The configuration form includes new options:
![alt text](form.png)

### ID Column Selection
- Allows users to specify which column contains the unique sample identifiers. Users can select from the available columns in the uploaded CSV file.

### Algorithm Selection
Users can choose between two randomization strategies:

1. **Balanced Block Randomization**
   - Proportionally distributes samples across plates
   - Maintains balance within plate rows

2. **Greedy Algorithm** (legacy)
   - Original algorithm implementation
   - Places samples iteratively with tolerance-based placement

### Control/Reference Sample Field
- Comma-separated list of labels (e.g., "Control, QC, Reference")
- Covariate groups containing these labels receive priority in color assignment - brighter colors assigned to make them more recognizable.

### Plate Dimensions (_only available for the Balanced Block Randomization algorithm_)
- **Rows**: Configurable from 1-16 (default: 8)
- **Columns**: Configurable from 1-24 (default: 12)
- **Display**: Shows calculated plate capacity (rows × columns)

### Empty Cell Distribution (_only available for the Balanced Block Randomization algorithm_)
Option to control how empty cells / wells are handled when sample count < total capacity:

- **Keep empty cells in last plate** (default checked): All empty cells are assigned to the final plate
- **Distribute evenly** (unchecked): Empty cells spread across all plates

### Covariate Display
- Selected covariates displayed below the **Select Covariates** selection box

---

## 3. New Balanced Block Randomization Algorithm


#### Two-Level Distribution
1. **Plate Level**: Distributes samples proportionally across all plates
2. **Row Level**: Distributes samples proportionally within each plate's rows


##### Phase 1: Proportional Placement
- Calculates expected minimum samples per covariate group
- Adjusts for varying plate capacities
- Places base allocation across all blocks (plates or rows)

##### Phase 2A: Unplaced Groups
- Handles covariate groups too small for Phase 1
- Distributes samples across available capacity
- Largest covariate groups processed first

##### Phase 2B: Overflow Handling
- Places remaining samples from Phase 1
- Uses prioritization strategies:
  - **Plate level**: Prioritizes full-capacity plates
  - **Row level**: Prioritizes rows with fewer samples of the group


---

## 4. Compact View Implementation

The original full-size plate view made it difficult to visualize sample distribution patterns across multiple plates simultaneously, especially when working with many plates. A compact view was added to enable quick overview of sample distribution over multiple plates.
Users can switch between views using the **Compact View** / **Full Size View** button in the control panel.

![alt text](compactPlates.png)

#### Compact View (Default)
- **Cell Size**: 18×16 pixels per cell
- Hover tooltip shows:
  - Sample name
  - Cell / well position (e.g., A05)
  - All covariate values

#### Full Size View (Toggle)
- **Cell Size**: 100×60 pixels per well
- Detailed information directly visible
  - Sample name prominently displayed
  - All covariate values shown within the plate cell

---

## 4. Plate Details Popup

Click the information icon ("i") in the header of any plate. The draggable popup displays the following:

#### Summary Statistics
- **Capacity**: Total number of  cells / wells in the plate
- **Samples**: Number of samples actually placed in the plate

#### Covariate Distribution Table

For each covariate group, displays:

|  |  |
|-----------|-------------|
| **Color Indicator** | 16×16px color box matching plate display |
| **Combination Details** | All covariate values in the group |
| **Count Ratio** | Samples in this plate / Total samples in group |
| **Percentage** | Percentage of group's samples on this plate |


![alt text](plateDetailsPopup.png)

---

## 5. "Re-randomize" Button

Generates a new randomization while preserving:
  - Current covariate selections
  - Algorithm choice
  - Plate dimensions
  - Color assignments
  - Empty space distribution settings

---

## 6. Covariate Groups Summary Panel

The summary panel provides an overview of all unique covariate groups.
- Toggle visibility using the "Show/Hide Covariate Summary" button.
- Summary items are sorted by sample count (descending) - covariate groups with most samples first.

#### Color Indicator
- Visual representation matching the plate display
- Shows fill pattern (solid/outline/stripes)

#### Sample Count
- Total number of samples in the group

#### Covariate Values
- Lists all covariate names and their values for the group
- Format: `Set: Training • Focus_Area: FA2 • Time_point: 21 • Dose_Rate: LDR`

![alt text](summaryView.png)

---

## 7. Interactive Highlighting

Click any covariate group in the summary panel to highlight (blue border; glowing effect) all samples belonging to that group in all the plates.

- **Persistence**: Highlighting persists when switching between views
- **Modal sync**: selected group also highlighted in plate details popup
- **Toggle**: Click the same group again to remove highlighting

![alt text](selectedCovariateGroup.png)
![alt text](cellHighlighted-Plate.png)
![alt text](selectionHighlighted-Modal.png)

---


## 8. Quality Scoring System

The application includes a comprehensive quality assessment system that evaluates both the balance and randomization quality of plate assignments. Quality scores are calculated automatically and updated in real-time as users make changes.

### Quality Metrics Overview

The system provides two primary quality scores:

#### Balance Score (0-100)
- **Purpose**: Measures how well each plate represents the overall population
- **Calculation**: Based on relative deviation from expected covariate proportions
- **Weighting**: Larger covariate groups have more influence on the score
- **Real-time**: Updates when samples are moved between or within plates

#### Randomization Score (0-100)
- **Purpose**: Measures spatial clustering and randomness of sample placement
- **Calculation**: Analyzes neighbor relationships to detect clustering patterns
- **Method**: Counts samples with different covariate profiles among spatial neighbors
- **Real-time**: Updates when samples are repositioned on plates

### Quality Score Display

#### Overall Quality Button
Located in the main control panel, shows:
- **Overall Score**: Average of balance and randomization scores
- **Quality Level**: Excellent (85+), Good (75-84), Fair (65-74), Poor (<65)
- **Color Coding**: Green (excellent), Orange (good/fair), Red (poor)

#### Individual Plate Headers
Each plate displays:
- **Bal**: Balance score for that specific plate
- **Rand**: Randomization score for that specific plate
- **Color Coding**: Scores colored by quality level

#### Quality Assessment Modal
Accessible via the quality button, provides:
- **Experiment Summary**: Overall scores and quality level
- **Individual Plate Scores**: Detailed breakdown for each plate
- **Recommendations**: Suggestions for improvement when scores are low
- **Sorting**: Plates sorted by overall quality (lowest first)

### Quality Score Calculation Details

#### Balance Score Methodology
For each covariate group on each plate:
```
Expected Count = (Group Size / Total Samples) × Plate Capacity
Relative Deviation = |Actual - Expected| / Expected
Group Balance Score = max(0, 100 - (Relative Deviation × 100))
```

Overall plate balance uses weighted averaging:
```
Weight = Expected Proportion (group size / total samples)
Weighted Deviation = Relative Deviation × Weight
Plate Balance Score = max(0, 100 - (Sum of Weighted Deviations × 100))
```

#### Randomization Score Methodology
For each sample position:
1. **Identify Neighbors**: All adjacent positions (8-directional)
2. **Compare Profiles**: Check if neighbors have different covariate combinations
3. **Calculate Ratio**: Different neighbors / Total neighbor comparisons
4. **Scale to 0-100**: Higher percentage = better randomization

#### Edge Case Handling
- **Small Groups**: Groups with <1 expected sample per plate use fractional calculations
- **Empty Groups**: Automatically receive perfect scores if no samples exist globally
- **Non-divisible Counts**: Uses fractional expected counts for precise calculations

### Quality Score Interpretation

#### Score Ranges
| Range | Level | Interpretation |
|-------|-------|----------------|
| 90-100 | Excellent | Near-perfect distribution/randomization |
| 80-89 | Good | Minor deviations, generally acceptable |
| 70-79 | Fair | Noticeable but manageable imbalances |
| 60-69 | Poor | Significant issues requiring attention |
| 0-59 | Very Poor | Major problems affecting study validity |

#### When to Re-randomize
Consider re-randomization when:
- Overall experiment score < 70
- Any individual plate score < 60
- Critical covariate groups show severe imbalance (>50% deviation)
- Multiple plates have poor randomization scores

### Real-time Quality Updates

#### Automatic Recalculation
Quality scores are automatically recalculated when:
- **Initial Randomization**: Scores calculated after plate generation
- **Re-randomization**: Full recalculation after using "Re-randomize" button
- **Individual Plate Re-randomization**: Scores update after using plate "R" button
- **Manual Drag & Drop**: Real-time updates when samples are moved
- **Cross-plate Movement**: Both affected plates recalculated

#### Performance Optimization
- **Single-pass Calculation**: Efficient algorithms for both balance and randomization
- **Incremental Updates**: Only affected plates recalculated during manual changes
- **Cached Results**: Avoids redundant calculations during UI updates

### Plate-specific Quality Features

#### Individual Plate Re-randomization
Each plate includes an "R" button that:
- **Balanced Algorithm**: Shuffles samples within rows only (preserves balance)
- **Other Algorithms**: Shuffles all samples across the entire plate
- **Quality Update**: Automatically recalculates scores after re-randomization

#### Plate Details Modal Enhancement
The plate details modal now includes:
- **Balance Information**: For each covariate group shows:
  - Balance score (0-100) with color coding
  - Expected count (fractional precision)
  - Actual count on the plate
  - Deviation percentage from expected
  - Weight (influence on overall balance score)
- **Sorting**: Covariate groups sorted by total samples → plate samples → name
- **Real-time Updates**: Reflects current quality metrics

### Quality-driven Workflow

#### Recommended Process
1. **Generate Initial Randomization**: Review overall quality scores
2. **Identify Problem Plates**: Focus on plates with scores < 70
3. **Use Targeted Re-randomization**: Click "R" on specific problematic plates
4. **Manual Fine-tuning**: Drag samples to optimize spatial arrangement
5. **Monitor Real-time Feedback**: Watch scores improve with each adjustment
6. **Validate Final Result**: Ensure acceptable quality before export

#### Quality vs. Balance Trade-offs
- **Small Groups**: Perfect balance may be impossible; focus on larger groups
- **Spatial vs. Balance**: Sometimes spatial randomization conflicts with balance
- **Acceptable Thresholds**: Document any accepted deviations with scientific justification

---



## Implementation Files

The original code was refactored, and new components and hooks were created.

### Core Components

- **App.tsx**: Main application for managing state and interactions
- **ConfigurationForm.tsx**: Enhanced form with all new options
- **Plate.tsx**: Rendering logic for individual plates (both full-size and compact views)
- **PlatesGrid.tsx**: Grid layout management for multiple plates
- **SummaryPanel.tsx**: Covariate groups summary visualization
- **PlateDetailsModal.tsx**: Draggable modal with covariate group distribution details for the plate

### Algorithm Files

- **balancedRandomization.ts**: New balanced block randomization implementation
- **greedyRandomization.ts**: Original algorithm (legacy)
- **utils.ts**: Shared utilities including color palette and helper functions

### Custom Hooks

- **useCovariateColors.ts**: Color assignment and management
- **useRandomization.ts**: Randomization process coordination
- **useModalDrag.ts**: Draggable modal functionality
- **useDragAndDrop.ts**: Sample drag-and-drop between wells


---

## Usage

1. **Upload CSV**: File containing sample metadata
2. **Configure**:
   - Select ID column
   - Choose covariates for balancing
   - (Optional) Enter control sample labels
   - Select randomization algorithm
   - Set plate dimensions
   - Choose empty space distribution strategy
3. **Generate**: Click "Generate Randomized Plates"
4. **Review**:
   - View sample distribution in compact or full view
   - Check covariate summary for balance
   - Click covariate groups in summary view to highlight samples in plates
   - Inspect individual plates using details modal
5. **Export**: Download CSV with plate assignments

---
| Metric | 15 Samples | 18 Samples | Impact |
|--------|------------|------------|---------|
| Expected per plate | 3.0 | 3.6 | Higher baseline |
| Actual distribution | [2,4,3,1,5] | [2,4,3,4,5] | More balanced |
| Chi-squared (χ²) | 3.32 | 1.43 | Lower (better) |
| P-value | 0.66 | 0.84 | Higher (better) |
| CV | 47.1% | 28.3% | Lower (better) |
| Balance Score | 5.8 | 43.4 | Much better |
