#!/usr/bin/env node

/**
 * Phase 4: Email Delivery - Comprehensive Test Suite
 * 
 * This script validates all Phase 4 components are ready for testing.
 * Run: npm run test:phase4
 */

const fs = require('fs');
const path = require('path');


const results: TestResult[] = [];
const backendSrc = path.join(__dirname, '..', 'src');

function checkFile(filePath: string, description: string): boolean {
  const exists = fs.existsSync(filePath);
  if (exists) {
    results.push({
      name: `✓ ${description}`,
      passed: true,
      message: `Found at ${filePath}`,
      severity: 'info',
    });
  } else {
    results.push({
      name: `✗ ${description}`,
      passed: false,
      message: `Missing ${filePath}`,
      severity: 'error',
    });
  }
  return exists;
}

function checkFileContent(filePath: string, searchText: string, description: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const found = content.includes(searchText);
    if (found) {
      results.push({
        name: `✓ ${description}`,
        passed: true,
        message: `Found in ${path.basename(filePath)}`,
        severity: 'info',
      });
    } else {
      results.push({
        name: `✗ ${description}`,
        passed: false,
        message: `"${searchText}" not found in ${path.basename(filePath)}`,
        severity: 'error',
      });
    }
    return found;
  } catch (error) {
    results.push({
      name: `✗ ${description}`,
      passed: false,
      message: `Error reading file: ${(error as any).message}`,
      severity: 'error',
    });
    return false;
  }
}

function printResults() {
  console.log('\n' + '='.repeat(70));
  console.log('📋 PHASE 4: EMAIL DELIVERY - COMPONENT VALIDATION');
  console.log('='.repeat(70) + '\n');

  const errors = results.filter((r) => r.severity === 'error');
  const warnings = results.filter((r) => r.severity === 'warning');
  const infos = results.filter((r) => r.severity === 'info');

  // Print results by severity
  if (infos.length > 0) {
    console.log('✅ PASSED CHECKS:\n');
    infos.forEach((r) => console.log(`  ${r.name}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    warnings.forEach((r) => console.log(`  ${r.name}: ${r.message}`));
    console.log();
  }

  if (errors.length > 0) {
    console.log('❌ FAILED CHECKS:\n');
    errors.forEach((r) => console.log(`  ${r.name}: ${r.message}`));
    console.log();
  }

  // Summary
  console.log('='.repeat(70));
  console.log(`SUMMARY: ${infos.length} passed, ${warnings.length} warnings, ${errors.length} errors`);
  console.log('='.repeat(70) + '\n');

  // Overall status
  if (errors.length === 0) {
    console.log('🚀 Phase 4 is ready for testing!\n');
    console.log('Next steps:');
    console.log('  1. Start Docker services: docker-compose up -d');
    console.log('  2. Start backend: npm run dev');
    console.log('  3. Run test endpoints:');
    console.log('     - curl -X POST http://localhost:3001/api/test/aggregate-news');
    console.log('     - curl -X POST http://localhost:3001/api/test/generate-summaries');
    console.log('     - curl -X POST http://localhost:3001/api/test/send-email');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Fix the errors above before proceeding.\n');
    process.exit(1);
  }
}

console.log('🔍 Checking Phase 4 components...\n');

// 1. Check Service Files
console.log('📦 Service Files:');
checkFile(path.join(backendSrc, 'services', 'EmailSender.ts'), 'EmailSender service');
checkFile(path.join(backendSrc, 'services', 'OllamaClient.ts'), 'Ollama client');
checkFile(path.join(backendSrc, 'services', 'SummarizationService.ts'), 'Summarization service');
checkFile(path.join(backendSrc, 'services', 'NewsAggregator.ts'), 'News aggregator');

// 2. Check Job Files
console.log('⏰ Scheduler Jobs:');
checkFile(path.join(backendSrc, 'jobs', 'dailyEmailJob.ts'), 'Daily email job');
checkFile(path.join(backendSrc, 'jobs', 'summarizationScheduler.ts'), 'Summarization scheduler');
checkFile(path.join(backendSrc, 'jobs', 'aggregationScheduler.ts'), 'Aggregation scheduler');

// 3. Check API Endpoints
console.log('🔗 API Endpoints:');
checkFileContent(
  path.join(backendSrc, 'index.ts'),
  '/api/test/send-email',
  'Email test endpoint'
);
checkFileContent(
  path.join(backendSrc, 'index.ts'),
  '/api/test/generate-summaries',
  'Summarization test endpoint'
);
checkFileContent(
  path.join(backendSrc, 'index.ts'),
  '/api/test/aggregate-news',
  'Aggregation test endpoint'
);
checkFileContent(
  path.join(backendSrc, 'index.ts'),
  '/api/summaries',
  'Get summaries endpoint'
);
checkFileContent(
  path.join(backendSrc, 'index.ts'),
  '/api/logs',
  'Email logs endpoint'
);

// 4. Check Configuration
console.log('⚙️  Configuration:');
checkFile(path.join(backendSrc, '..', 'src', 'config', 'topics.json'), 'Topics configuration');
checkFile(path.join(backendSrc, '..', '.env.example'), 'Environment template');

// 5. Check Database Schema
console.log('🗄️  Database:');
checkFile(path.join(backendSrc, '..', 'src', 'database', 'schema.sql'), 'Database schema');
checkFileContent(
  path.join(backendSrc, '..', 'src', 'database', 'schema.sql'),
  'CREATE TABLE summaries',
  'Summaries table in schema'
);
checkFileContent(
  path.join(backendSrc, '..', 'src', 'database', 'schema.sql'),
  'CREATE TABLE email_logs',
  'Email logs table in schema'
);

// 6. Check Documentation
console.log('📚 Documentation:');
checkFile(path.join(backendSrc, '..', 'PHASE4_TESTING_GUIDE.md'), 'Phase 4 testing guide');
checkFile(path.join(backendSrc, '..', 'README.md'), 'Project README');

// Print results
printResults();
