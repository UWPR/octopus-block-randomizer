# Implementation Plan

This document provides a step-by-step implementation plan for adding repeated-measures variable support to the balanced randomization algorithm. Each task builds incrementally on previous tasks, with all code integrated and functional at each step.

## Task List

- [x] 1. Set up core data structures and interfaces





  - Create new TypeScript interfaces for repeated-measures groups and configuration
  - Update existing types to support repeated-measures functionality
  - Ensure type safety across the codebase
  - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 2. Implement repeated-measures grouping logic



  - [x] 2.1 Create `repeatedMeasuresGrouping.ts` module with group creation function




    - Implement `createRepeatedMeasuresGroups()` function
    - Handle samples with and without subject IDs (singleton creation)
    - Calculate treatment composition for each group
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2_

  - [ ] 2.2 Implement group validation function
    - Check for oversized groups (exceed plate capacity)
    - Warn about large groups (> 50% plate capacity)
    - Warn about high singleton ratio (> 80%)
    - Return structured validation results with errors and warnings
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.3 Write unit tests for grouping and validation
    - Test basic grouping by subject ID
    - Test singleton creation for samples without subject ID
    - Test treatment composition calculation
    - Test validation error detection
    - Test validation warning detection
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

- [ ] 3. Implement plate distribution algorithm
  - [ ] 3.1 Create `repeatedMeasuresDistribution.ts` module with distribution function
    - Implement `distributeGroupsToPlates()` function
    - Calculate global treatment distribution from samples
    - Sort groups by size (largest first)
    - Initialize plate assignments and tracking
    - _Requirements: 5.1, 5.2, 6.1, 7.1, 7.2, 7.3, 7.4_

  - [ ] 3.2 Implement balance score calculation
    - Calculate current and hypothetical plate compositions
    - Compute deviation from expected treatment proportions
    - Handle rare treatment groups with fractional expected counts
    - Return balance score (lower = better)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.3 Implement best plate selection logic
    - Check capacity constraints for each candidate plate
    - Calculate balance score for each viable plate
    - Select plate with lowest balance score
    - Handle case where no plate can fit the group
    - _Requirements: 5.1, 5.3, 6.2, 6.3, 7.1, 7.2_

  - [ ]* 3.4 Write unit tests for distribution algorithm
    - Test distribution respects capacity constraints
    - Test groups stay together on same plate
    - Test balance score calculation
    - Test best plate selection
    - Test error handling for oversized groups
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 7.1, 7.2_

- [ ] 4. Integrate with main randomization algorithm
  - [ ] 4.1 Modify `balancedRandomization.ts` to support repeated-measures path
    - Update function signature to accept `RandomizationConfig`
    - Add routing logic: if `repeatedMeasuresVariable` is set, use new path
    - Maintain backward compatibility when no repeated-measures variable
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 4.2 Implement repeated-measures-aware randomization function
    - Create repeated-measures groups
    - Validate groups
    - Calculate plate capacities
    - Distribute groups to plates
    - Flatten groups back to samples
    - Apply existing row distribution to each plate
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 7.1, 9.1, 9.2, 9.3_

  - [ ] 4.3 Implement repeated-measures constraint validation
    - Verify no groups are split across plates
    - Log validation results
    - Throw error if constraints violated
    - _Requirements: 5.2, 5.4, 14.1, 14.3, 14.4_

  - [ ] 4.4 Update return type to include repeated-measures metadata
    - Return repeated-measures groups array
    - Return quality metrics
    - Maintain backward compatibility
    - _Requirements: 11.6_

  - [ ]* 4.5 Write integration tests for end-to-end randomization
    - Test simple case with equal-sized groups
    - Test uneven group sizes
    - Test mixed groups and singletons
    - Test multiple plates
    - Test backward compatibility (no repeated-measures variable)
    - _Requirements: 5.1, 5.2, 6.1, 6.5, 8.1, 8.2, 8.3, 8.4, 10.1, 10.2_

- [ ] 5. Implement quality metrics and reporting
  - [ ] 5.1 Extend quality metrics calculation
    - Calculate repeated-measures constraint satisfaction
    - Calculate treatment balance score
    - Calculate group size distribution
    - Calculate per-plate group counts
    - Include standard quality metrics
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 5.2 Add console logging for debugging
    - Log group creation summary
    - Log validation results
    - Log distribution progress
    - Log final constraint validation
    - _Requirements: 11.5, 14.4_

- [ ] 6. Update user interface components
  - [ ] 6.1 Add repeated-measures variable selector to ConfigurationForm
    - Add dropdown below treatment variables selector
    - Label as "Select Repeated-measures Variables (Optional)"
    - Add descriptive help text
    - Populate with available columns
    - Exclude columns already selected as treatment variables
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 12.1, 12.2_

  - [ ] 6.2 Implement variable mutual exclusivity validation
    - Prevent same variable being both treatment and repeated-measures
    - Display error message when conflict detected
    - Disable randomization button while error exists
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 12.4_

  - [ ] 6.3 Add informational message for selected repeated-measures variable
    - Display below selector when variable is selected
    - Show message: "All samples with the same [VariableName] value will be assigned to the same plate"
    - _Requirements: 12.3_

  - [ ] 6.4 Display validation errors and warnings
    - Show oversized group errors in red
    - Show large group warnings in yellow/orange
    - Show high singleton ratio warnings
    - Provide clear, actionable messages
    - _Requirements: 4.2, 4.3, 4.4, 12.4, 12.5, 14.1, 14.2_

  - [ ] 6.5 Update SummaryPanel to display repeated-measures metrics
    - Add section for repeated-measures groups
    - Show total groups, multi-sample groups, singleton groups
    - Show largest group information
    - Show treatment balance score
    - Show per-plate group counts
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.6_

- [ ] 7. Performance optimization and testing
  - [ ] 7.1 Optimize data structures and algorithms
    - Use Map for O(1) lookups
    - Pre-calculate treatment compositions
    - Avoid unnecessary recalculations
    - Implement early termination in distribution
    - _Requirements: 13.2, 13.3_

  - [ ]* 7.2 Write performance tests
    - Test with 1000 samples and 100 groups (< 2 seconds)
    - Test with 5000 samples and 500 groups (< 10 seconds)
    - Monitor memory usage
    - _Requirements: 13.1_

- [ ] 8. Documentation and final polish
  - [ ] 8.1 Update code documentation
    - Add JSDoc comments to all new functions
    - Document parameters and return types
    - Add usage examples
    - Document edge cases and limitations

  - [ ] 8.2 Update user-facing documentation
    - Add section on repeated-measures variables
    - Provide examples of when to use this feature
    - Document limitations and best practices
    - Add troubleshooting guide

  - [ ] 8.3 Final testing and validation
    - Run full test suite
    - Test with real-world datasets
    - Verify backward compatibility
    - Check for edge cases
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

## Implementation Notes

### Task Dependencies

- Tasks 1-2 can be done independently
- Task 3 depends on Task 2 (needs group structures)
- Task 4 depends on Tasks 2-3 (needs grouping and distribution)
- Task 5 depends on Task 4 (needs integrated algorithm)
- Task 6 can be done in parallel with Tasks 4-5
- Task 7 depends on all previous tasks
- Task 8 is final polish

### Testing Strategy

- Unit tests marked with `*` are optional but recommended
- Integration tests should be written as features are completed
- Performance tests should be run on realistic datasets
- All tests should pass before moving to next major task

### Incremental Development

Each task should result in working, integrated code:
- After Task 1: Types are defined and compile
- After Task 2: Can create and validate groups
- After Task 3: Can distribute groups to plates
- After Task 4: Full randomization works end-to-end
- After Task 5: Quality metrics are calculated and logged
- After Task 6: UI is fully functional
- After Task 7: Performance is optimized
- After Task 8: Feature is complete and documented

### Code Review Checkpoints

Recommended review points:
1. After Task 2: Review group creation logic
2. After Task 3: Review distribution algorithm
3. After Task 4: Review integration with main algorithm
4. After Task 6: Review UI implementation
5. After Task 8: Final review before merge

## Success Criteria

- [ ] All repeated-measures groups stay on same plate (no splits)
- [ ] Treatment balance is maintained approximately across plates
- [ ] Singletons are handled correctly
- [ ] Plate capacity constraints are respected
- [ ] Backward compatibility is maintained
- [ ] Performance meets requirements (< 2s for 1000 samples)
- [ ] UI provides clear feedback and validation
- [ ] Error messages are helpful and actionable
- [ ] Code is well-documented and tested
- [ ] Feature works with real-world datasets
