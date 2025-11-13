import React from 'react';
import { RandomizationAlgorithm, getAlgorithmName, getAlgorithmDescription, getAlgorithmsInDisplayOrder } from '../utils/types';

interface ConfigurationFormProps {
  availableColumns: string[];
  selectedIdColumn: string;
  onIdColumnChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  searches: any[];
  selectedCovariates: string[];
  onCovariateChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  selectedRepeatedMeasuresVariable: string;
  onRepeatedMeasuresVariableChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  controlLabels: string;
  onControlLabelsChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedAlgorithm: RandomizationAlgorithm;
  onAlgorithmChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  keepEmptyInLastPlate: boolean;
  onKeepEmptyInLastPlateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  plateRows: number;
  plateColumns: number;
  onPlateRowsChange: (value: number) => void;
  onPlateColumnsChange: (value: number) => void;
  onResetCovariateState: () => void;
  hasVariableConflict?: boolean;
}

const ConfigurationForm: React.FC<ConfigurationFormProps> = ({
  availableColumns,
  selectedIdColumn,
  onIdColumnChange,
  searches,
  selectedCovariates,
  onCovariateChange,
  selectedRepeatedMeasuresVariable,
  onRepeatedMeasuresVariableChange,
  controlLabels,
  onControlLabelsChange,
  selectedAlgorithm,
  onAlgorithmChange,
  keepEmptyInLastPlate,
  onKeepEmptyInLastPlateChange,
  plateRows,
  plateColumns,
  onPlateRowsChange,
  onPlateColumnsChange,
  onResetCovariateState,
  hasVariableConflict = false,
}) => {
  if (availableColumns.length === 0) return null;

  // Get available columns for repeated-measures variable (exclude treatment variables)
  const availableRepeatedMeasuresColumns = searches.length > 0
    ? Object.keys(searches[0].metadata).filter(col => !selectedCovariates.includes(col))
    : [];

  // Check for variable conflict (same variable used as both treatment and repeated-measures)
  const variableConflict = selectedRepeatedMeasuresVariable &&
    selectedCovariates.includes(selectedRepeatedMeasuresVariable);

  return (
    <div style={styles.compactFormContainer}>
      {/* Top Row: ID Column and Covariates */}
      <div style={styles.compactRow}>
        {/* Left Column: ID Column Selection and Algorithm */}
        <div style={styles.compactColumn}>
          <label htmlFor="idColumn" style={styles.compactLabel}>Select ID Column:</label>
          <select
            id="idColumn"
            value={selectedIdColumn}
            onChange={onIdColumnChange}
            style={styles.compactSelect}
          >
            {availableColumns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>

          <label htmlFor="controlLabels" style={{ ...styles.compactLabel, marginTop: '10px' }}>
            Control/Reference Sample Labels (optional):
          </label>
          <input
            id="controlLabels"
            type="text"
            value={controlLabels}
            onChange={onControlLabelsChange}
            placeholder="e.g., Inter-Experiment Reference, Control, QC"
            style={styles.compactTextInput}
          />
          <small style={styles.compactHint}>
            Enter labels separated by commas. Samples containing these labels will get priority colors.
          </small>

          <label htmlFor="algorithm" style={{ ...styles.compactLabel, marginTop: '10px' }}>
            Randomization Algorithm:
          </label>
          <select
            id="algorithm"
            value={selectedAlgorithm}
            onChange={onAlgorithmChange}
            style={styles.compactSelect}
          >
            {getAlgorithmsInDisplayOrder().map((algorithm) => (
              <option key={algorithm} value={algorithm}>
                {getAlgorithmName(algorithm)}
              </option>
            ))}
          </select>
          <small style={styles.algorithmDescription}>
            {getAlgorithmDescription(selectedAlgorithm)}
          </small>
        </div>

        {/* Right Column: Covariate Selection */}
        {searches.length > 0 && (
          <div style={styles.compactColumn}>
            <label htmlFor="covariates" style={styles.compactLabel}>Select Covariates:</label>
            <select
              id="covariates"
              multiple
              value={selectedCovariates}
              onChange={onCovariateChange}
              style={styles.compactMultiSelect}
            >
              {Object.keys(searches[0].metadata).map((covariate) => (
                <option key={covariate} value={covariate}>
                  {covariate}
                </option>
              ))}
            </select>
            <small style={styles.compactHint}>Hold Ctrl/Cmd to select multiple options</small>
            {selectedCovariates.length > 0 && (
              <div style={styles.selectedCovariatesDisplay}>
                <small style={styles.selectedCovariatesList}>
                  <span style={styles.selectedCovariatesLabel}>Selected: </span>
                  {selectedCovariates.join(', ')}
                </small>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Repeated-measures Variable Selection Row */}
      {searches.length > 0 && selectedAlgorithm === 'balanced' && (
        <div style={styles.compactRow}>
          <div style={styles.fullWidthColumn}>
            <label htmlFor="repeatedMeasuresVariable" style={styles.compactLabel}>
              Select Repeated-measures Variables (Optional):
            </label>
            <select
              id="repeatedMeasuresVariable"
              value={selectedRepeatedMeasuresVariable}
              onChange={onRepeatedMeasuresVariableChange}
              style={styles.compactSelect}
            >
              <option value="">None</option>
              {availableRepeatedMeasuresColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <small style={styles.compactHint}>
              Select a variable to group samples from the same subject that must stay on the same plate (e.g., PatientID)
            </small>
            {variableConflict && (
              <div style={styles.errorBox}>
                <small style={styles.errorText}>
                  ⚠ A variable cannot be both a treatment variable and a repeated-measures variable. Please select different variables.
                </small>
              </div>
            )}
            {selectedRepeatedMeasuresVariable && !variableConflict && (
              <div style={styles.repeatedMeasuresInfoBox}>
                <small style={styles.repeatedMeasuresInfoText}>
                  ℹ All samples with the same <strong>{selectedRepeatedMeasuresVariable}</strong> value will be assigned to the same plate
                </small>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-greedy Algorithm Options */}
      {selectedAlgorithm !== 'greedy' && (
        <div style={styles.compactRow}>
          <div style={styles.fullWidthColumn}>
            <div style={styles.balancedOptionsContainer}>
              <div style={styles.optionsRow}>
                <label style={styles.compactCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={keepEmptyInLastPlate}
                    onChange={onKeepEmptyInLastPlateChange}
                    style={styles.checkbox}
                  />
                  Keep empty spots in last plate
                </label>

                <div style={styles.plateDimensionsInline}>
                  <span style={styles.dimensionLabel}>Plate Rows:</span>
                  <input
                    id="plateRows"
                    type="number"
                    min="1"
                    max="16"
                    value={plateRows}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(16, parseInt(e.target.value) || 8));
                      onPlateRowsChange(value);
                      onResetCovariateState();
                    }}
                    style={styles.compactDimensionInput}
                  />

                  <span style={styles.dimensionLabel}>Plate Columns:</span>
                  <input
                    id="plateColumns"
                    type="number"
                    min="1"
                    max="24"
                    value={plateColumns}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(24, parseInt(e.target.value) || 12));
                      onPlateColumnsChange(value);
                      onResetCovariateState();
                    }}
                    style={styles.compactDimensionInput}
                  />

                  <small style={styles.compactDimensionNote}>
                    Plate size: {plateRows} × {plateColumns} = {plateRows * plateColumns} wells
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  compactFormContainer: {
    width: '100%',
    maxWidth: '1200px',
    marginBottom: '25px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
  },
  compactRow: {
    display: 'flex',
    gap: '30px',
    marginBottom: '20px',
    alignItems: 'flex-start',
  },
  compactColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  fullWidthColumn: {
    width: '100%',
  },
  compactLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '0px',
  },
  compactSelect: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    backgroundColor: '#fff',
    minHeight: '20px',
  },
  compactMultiSelect: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    backgroundColor: '#fff',
    minHeight: '165px',
    resize: 'vertical' as const,
  },
  compactTextInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    backgroundColor: '#fff',
    minHeight: '20px',
  },
  compactHint: {
    color: '#666',
    fontSize: '12px',
    fontStyle: 'italic',
    marginTop: '0px',
    marginLeft: '3px',
  },
  algorithmDescription: {
    color: '#666',
    fontSize: '11px',
    fontStyle: 'italic',
    lineHeight: '1.3',
    marginTop: '2px',
  },
  selectedCovariatesDisplay: {
    marginTop: '0px',
    padding: '8px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    border: '1px solid #bbdefb',
  },
  selectedCovariatesList: {
    fontSize: '12px',
    color: '#1976d2',
  },
  selectedCovariatesLabel: {
    fontWeight: '600',
  },
  balancedOptionsContainer: {
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #ddd',
  },
  optionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
    flexWrap: 'wrap' as const,
  },
  compactCheckboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
    fontWeight: '500',
  },
  checkbox: {
    marginRight: '8px',
    cursor: 'pointer',
  },
  plateDimensionsInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  dimensionLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  compactDimensionInput: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    width: '60px',
    textAlign: 'center' as const,
  },
  compactDimensionNote: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
  },
  repeatedMeasuresInfoBox: {
    marginTop: '8px',
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    border: '1px solid #bbdefb',
  },
  repeatedMeasuresInfoText: {
    fontSize: '13px',
    color: '#1565c0',
    lineHeight: '1.4',
  },
  errorBox: {
    marginTop: '8px',
    padding: '10px',
    backgroundColor: '#ffebee',
    borderRadius: '4px',
    border: '1px solid #ef5350',
  },
  errorText: {
    fontSize: '13px',
    color: '#c62828',
    lineHeight: '1.4',
    fontWeight: '500',
  },
};

export default ConfigurationForm;