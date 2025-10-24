#!/usr/bin/env node

/**
 * Test runner that executes Jest test files
 * Run with: npx ts-node src/runTests.ts
 */

import { execSync } from 'child_process';

console.log('Starting Quality Metrics Tests...\n');

const testFiles = [
  'src/tests/calculateExpectedRuns.jest.test.ts',
  'src/tests/calculateExpectedRunsByGroup.jest.test.ts'
];

try {
  for (const testFile of testFiles) {
    console.log('=' .repeat(60));
    console.log(`Running ${testFile}`);
    console.log('=' .repeat(60));
    
    // Run Jest for the specific test file
    const command = `npm test -- --testPathPattern="${testFile}" --verbose`;
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      console.error(`\n❌ Tests failed in ${testFile}`);
      throw error;
    }
    
    console.log(`\n✅ Tests completed successfully for ${testFile}\n`);
  }

  console.log('=' .repeat(60));
  console.log('🎉 All test files completed successfully!');
  console.log('=' .repeat(60));

} catch (error) {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
}