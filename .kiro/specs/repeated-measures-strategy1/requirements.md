# Requirements Document

## Introduction

This document specifies the requirements for implementing replicate covariate support in the balanced randomization algorithm using Strategy 1 (Weighted Replicate Groups). The feature enables users to group samples that must stay together on the same plate (e.g., biological replicates from the same patient) while maintaining approximate treatment covariate balance across plates.

## Glossary

- **System**: The Octopus Block Randomizer application
- **Repeated-measures Variable**: A metadata field (e.g., PatientID, SubjectID) that identifies samples from the same subject that must be assigned to the same plate
- **Treatment Variable**: A metadata field (e.g., Treatment, Timepoint, Condition) used for balancing samples across plates
- **Repeated-measures Group**: A collection of samples sharing the same repeated-measures variable value that must stay together on the same plate
- **Singleton**: A sample without a repeated-measures variable value, treated as an independent unit
- **Plate Capacity**: The maximum number of samples a plate can hold (rows × columns)
- **Treatment Balance**: The distribution of treatment variable combinations across plates, ideally proportional to global distribution

## Requirements

### Requirement 1: Repeated-measures Variable Selection

**User Story:** As a researcher, I want to select a repeated-measures variable separately from treatment variables, so that I can group samples from the same subject that must stay together on the same plate.

#### Acceptance Criteria

1. WHEN the user accesses the configuration interface, THE System SHALL display a "Select Repeated-measures Variables" dropdown selector separate from the "Select Treatment Variables" selector
2. WHEN the user selects a repeated-measures variable, THE System SHALL display all available metadata columns as options
3. WHERE a repeated-measures variable is selected, THE System SHALL allow the user to deselect it to disable repeated-measures grouping
4. THE System SHALL allow the user to proceed without selecting a repeated-measures variable

### Requirement 2: Variable Mutual Exclusivity

**User Story:** As a researcher, I want the system to prevent me from using the same variable as both treatment and repeated-measures, so that I avoid configuration errors.

#### Acceptance Criteria

1. WHEN the user selects a variable as a treatment variable, THE System SHALL exclude that variable from the repeated-measures variable options
2. WHEN the user selects a variable as a repeated-measures variable, THE System SHALL exclude that variable from the treatment variable options
3. IF the user attempts to use the same variable for both purposes, THEN THE System SHALL display an error message stating "A variable cannot be both a treatment variable and a repeated-measures variable"
4. THE System SHALL prevent randomization execution while this validation error exists

### Requirement 3: Repeated-measures Group Creation

**User Story:** As a researcher, I want samples with the same subject ID to be grouped together, so that repeated measurements from the same subject can be assigned to the same plate.

#### Acceptance Criteria

1. WHEN a repeated-measures variable is selected, THE System SHALL group all samples sharing the same repeated-measures variable value into repeated-measures groups
2. WHEN a sample has no value for the repeated-measures variable, THE System SHALL treat that sample as a singleton group with a unique identifier
3. THE System SHALL calculate the size of each repeated-measures group as the count of samples in that group
4. THE System SHALL calculate the treatment composition of each repeated-measures group by counting samples for each treatment variable combination
5. THE System SHALL store repeated-measures group information including subject ID, samples list, treatment composition, and size

### Requirement 4: Repeated-measures Group Validation

**User Story:** As a researcher, I want to be notified if my repeated-measures groups are too large for the plate capacity, so that I can adjust my configuration before randomization fails.

#### Acceptance Criteria

1. WHEN repeated-measures groups are created, THE System SHALL validate that no repeated-measures group size exceeds the plate capacity
2. IF any repeated-measures group size exceeds plate capacity, THEN THE System SHALL display an error message identifying the oversized groups and their sizes
3. IF any repeated-measures group size exceeds 50% of plate capacity, THEN THE System SHALL display a warning message that large groups may limit balancing flexibility
4. IF more than 80% of repeated-measures groups are singletons, THEN THE System SHALL display a warning suggesting the user verify the repeated-measures variable selection
5. THE System SHALL prevent randomization execution while validation errors exist

### Requirement 5: Plate Distribution with Repeated-measures Constraint

**User Story:** As a researcher, I want all samples from the same subject assigned to the same plate, so that repeated measurements are processed together.

#### Acceptance Criteria

1. WHEN distributing samples to plates, THE System SHALL assign all samples from a repeated-measures group to the same plate
2. THE System SHALL verify that no repeated-measures group is split across multiple plates
3. IF the System cannot assign a repeated-measures group to any plate due to capacity constraints, THEN THE System SHALL display an error message identifying the problematic group
4. THE System SHALL validate repeated-measures constraints after distribution and report any violations

### Requirement 6: Treatment Balance Maintenance

**User Story:** As a researcher, I want treatment variables to be approximately balanced across plates even with repeated-measures constraints, so that my experimental design remains valid.

#### Acceptance Criteria

1. WHEN distributing repeated-measures groups to plates, THE System SHALL calculate the expected proportion of each treatment combination based on global distribution
2. WHEN selecting a plate for a repeated-measures group, THE System SHALL evaluate how adding that group affects treatment balance on each candidate plate
3. THE System SHALL assign each repeated-measures group to the plate that minimizes deviation from expected treatment proportions
4. THE System SHALL calculate and report treatment balance scores for each plate after distribution
5. THE System SHALL accept that perfect treatment balance may not be achievable due to repeated-measures constraints

### Requirement 7: Capacity-Aware Distribution

**User Story:** As a researcher, I want the system to respect plate capacity limits when assigning repeated-measures groups, so that no plate is overfilled.

#### Acceptance Criteria

1. WHEN evaluating candidate plates for a repeated-measures group, THE System SHALL check that the plate has sufficient remaining capacity
2. THE System SHALL exclude plates from consideration if adding the repeated-measures group would exceed plate capacity
3. THE System SHALL track the current sample count for each plate during distribution
4. THE System SHALL calculate plate capacities based on the keepEmptyInLastPlate setting and total sample count

### Requirement 8: Singleton Handling

**User Story:** As a researcher, I want samples without subject IDs to be distributed independently, so that they don't artificially constrain the randomization.

#### Acceptance Criteria

1. WHEN a sample has no repeated-measures variable value, THE System SHALL create a singleton repeated-measures group with a unique identifier for that sample
2. THE System SHALL treat singleton groups as independent units during distribution
3. THE System SHALL allow singleton groups to be distributed to any plate with capacity
4. THE System SHALL not group multiple samples without subject IDs together

### Requirement 9: Row Distribution Integration

**User Story:** As a researcher, I want samples within each plate to be distributed to rows using the existing balanced algorithm, so that row-level balance is maintained.

#### Acceptance Criteria

1. WHEN repeated-measures groups have been assigned to plates, THE System SHALL flatten the groups back to individual samples
2. THE System SHALL apply the existing row distribution algorithm to samples within each plate
3. THE System SHALL maintain treatment variable balance at the row level within each plate
4. THE System SHALL preserve the existing row distribution behavior for backward compatibility

### Requirement 10: Backward Compatibility

**User Story:** As a researcher, I want the existing randomization behavior to remain unchanged when I don't select a repeated-measures variable, so that my current workflows continue to work.

#### Acceptance Criteria

1. WHEN no repeated-measures variable is selected, THE System SHALL use the existing randomization algorithm without modification
2. THE System SHALL produce identical results to the previous version when no repeated-measures variable is specified
3. THE System SHALL maintain all existing function signatures and return types for backward compatibility
4. THE System SHALL not introduce breaking changes to the existing API

### Requirement 11: Quality Metrics Reporting

**User Story:** As a researcher, I want to see quality metrics about repeated-measures groups and treatment balance, so that I can assess the quality of the randomization.

#### Acceptance Criteria

1. WHEN randomization completes with a repeated-measures variable, THE System SHALL display in the summary panel the total number of repeated-measures groups created
2. THE System SHALL display in the summary panel the count of singleton groups and multi-sample groups separately
3. THE System SHALL display in the summary panel the treatment balance score for each plate
4. THE System SHALL display in the summary panel the number of repeated-measures groups assigned to each plate
5. THE System SHALL log to the console detailed information about repeated-measures group distribution during randomization
6. THE System SHALL return repeated-measures group information in the randomization function result for programmatic access

### Requirement 12: User Interface Integration

**User Story:** As a researcher, I want clear visual feedback about repeated-measures variable selection and validation, so that I can configure the feature correctly.

#### Acceptance Criteria

1. WHEN the configuration form is displayed, THE System SHALL show a "Select Repeated-measures Variables" section with a dropdown selector below the "Select Treatment Variables" section
2. THE System SHALL display descriptive text explaining "Select a variable to group samples from the same subject that must stay on the same plate (e.g., PatientID)"
3. WHEN a repeated-measures variable is selected, THE System SHALL display an informational message below the selector stating "All samples with the same [VariableName] value will be assigned to the same plate"
4. WHEN validation errors occur, THE System SHALL display error messages in red text with clear descriptions below the relevant selector
5. WHEN validation warnings occur, THE System SHALL display warning messages in yellow/orange text with helpful suggestions
6. THE System SHALL update the summary panel after randomization to show repeated-measures group statistics including group count, size distribution, and per-plate assignments

### Requirement 13: Performance Requirements

**User Story:** As a researcher, I want the repeated-measures-aware randomization to complete quickly even with large datasets, so that I can iterate on my experimental design efficiently.

#### Acceptance Criteria

1. WHEN processing 1000 samples with 100 repeated-measures groups, THE System SHALL complete randomization in less than 2 seconds
2. THE System SHALL use efficient data structures to minimize memory usage during distribution
3. THE System SHALL avoid unnecessary recalculations of treatment compositions
4. THE System SHALL provide progress feedback for long-running operations

### Requirement 14: Error Handling and Recovery

**User Story:** As a researcher, I want clear error messages when randomization fails, so that I can understand and fix the problem.

#### Acceptance Criteria

1. IF randomization fails due to oversized repeated-measures groups, THEN THE System SHALL display an error message listing the problematic groups with their sizes
2. IF randomization fails due to capacity constraints, THEN THE System SHALL suggest increasing plate size or splitting large repeated-measures groups
3. IF validation fails, THEN THE System SHALL prevent randomization execution and display all validation errors
4. THE System SHALL log detailed error information to the console for debugging purposes
