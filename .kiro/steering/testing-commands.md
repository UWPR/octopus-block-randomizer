# Testing Commands

This project uses Jest via react-scripts for testing.

## Running Tests

### Interactive Watch Mode (Development)
```bash
npm test
```
This launches Jest in watch mode, which is useful during development.

### Single Run (CI/Automated Testing)
```bash
npm test -- --watchAll=false
```
This runs all tests once and exits. Use this for:
- Continuous Integration (CI) pipelines
- Pre-commit hooks
- Automated validation
- When you want to verify all tests pass without entering watch mode

### Additional Options

Run tests with verbose output:
```bash
npm test -- --watchAll=false --verbose
```

Run specific test file:
```bash
npm test -- --watchAll=false src/tests/repeatedMeasuresIntegration.test.ts
```

Run tests matching a pattern:
```bash
npm test -- --watchAll=false --testNamePattern="repeated-measures"
```

## Important Notes

- **DO NOT use `--run` flag** - This is a Vitest flag and will cause an error with Jest
- The correct Jest flag for non-interactive mode is `--watchAll=false`
- This project uses Jest (via react-scripts), not Vitest
