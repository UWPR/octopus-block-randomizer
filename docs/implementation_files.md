## Implementation Files

The original code was refactored, and new components and hooks were created to support the enhanced functionality including new randomization algorithm, quality scoring, individual plate re-randomization, and improved user interface.

### Core Components

- **App.tsx**: Main application managing state, interactions, and quality metrics integration
- **ConfigurationForm.tsx**: Enhanced form with algorithm selection, plate dimensions, and control sample options
- **Plate.tsx**: Individual plate rendering with compact/full views, quality scores display, and re-randomization buttons
- **PlatesGrid.tsx**: Grid layout management for multiple plates with quality metrics integration
- **SummaryPanel.tsx**: Covariate groups summary with interactive highlighting and sorting
- **PlateDetailsModal.tsx**: Draggable modal with enhanced covariate distribution, quality metrics, and real-time balance information
- **QualityMetricsPanel.tsx**: Quality assessment modal displaying overall scores, individual plate metrics, and recommendations
- **FileUploadSection.tsx**: File upload interface with validation and column detection

### Algorithm Files

- **balancedRandomization.ts**: Advanced balanced randomization with two-level distribution
- **greedyRandomization.ts**: Original greedy algorithm implementation (legacy support)
- **utils.ts**: Shared utilities including expanded color palette, covariate grouping, and CSV export functionality

### Quality Assessment System

- **qualityMetrics.ts**: Core quality calculation engine with balance and randomization scoring
- **useQualityMetrics.ts**: Hook for managing quality state, calculations, and real-time updates

### Custom Hooks

- **useCovariateColors.ts**: Advanced color assignment with priority handling and pattern support (solid/outline/stripes)
- **useRandomization.ts**: Randomization coordination with individual plate re-randomization and algorithm-specific behavior
- **useModalDrag.ts**: Draggable modal functionality with position management
- **useDragAndDrop.ts**: Sample drag-and-drop with automatic quality recalculation
- **useFileUpload.ts**: File upload management with CSV parsing and column detection

### Type Definitions

- **types.ts**: Comprehensive TypeScript interfaces including:
  - `SearchData`: Sample metadata structure
  - `QualityMetrics`: Quality assessment data structures
  - `PlateQualityScore`: Individual plate quality information
  - `CovariateColorInfo`: Color assignment and pattern definitions
  - `RandomizationAlgorithm`: Algorithm type definitions

### Utility Functions

- **Color Management**: 24-color palette with recycling and pattern support
- **Quality Calculations**: Balance scoring, spatial analysis, and weighted averaging
- **Data Processing**: Covariate grouping, sample distribution, and CSV handling
- **UI Helpers**: Drag and drop coordination, modal positioning, and state management


---