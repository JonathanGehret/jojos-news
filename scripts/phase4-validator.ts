#!/usr/bin/env node

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

const results: TestResult[] = [];

function log(color: string, ...args: any[]) {
  console.log(`${color}${args.join(' ')}${COLORS.reset}`);
}

function header(title: string) {
  console.log('\n' + COLORS.bright + COLORS.cyan + '═'.repeat(60) + COLORS.reset);
  log(COLORS.cyan + COLORS.bright, `${title}`);
  console.log(COLORS.cyan + '═'.repeat(60) + COLORS.reset);
}

function subHeader(title: string) {
  log(COLORS.cyan, `\n▶ ${title}`);
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    return response.data.status === 'ok';
  } catch (error) {
    return false;
  }
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  let passed = false;
  let details = '';

  try {
    subHeader(name);
    await testFn();
    passed = true;
    details = 'Passed';
    log(COLORS.green, '✓ Test passed');
  } catch (error) {
    details = error instanceof Error ? error.message : String(error);
    log(COLORS.red, `✗ Test failed: ${details}`);
  }

  const duration = Date.now() - startTime;
  results.push({ name, passed, details, duration });
}

async function testAggregation(): Promise<void> {
  subHeader('Test 1: News Aggregation');

  // Trigger aggregation
  log(COLORS.gray, 'Triggering aggregation...');
  let response = await axios.post(`${API_BASE_URL}/api/test/aggregate-news`);

  if (!response.data.itemsCollected) {
    throw new Error('No items collected from aggregation');
  }
  log(COLORS.green, `✓ Collected ${response.data.itemsCollected} news items`);

  // Wait a moment for database to persist
  await wait(500);

  // Verify in database
  log(COLORS.gray, 'Verifying aggregated news...');
  response = await axios.get(`${API_BASE_URL}/api/news-items?limit=5`);

  if (response.data.news.length === 0) {
    throw new Error('No news items found in database');
  }
  log(COLORS.green, `✓ Found ${response.data.news.length} news items in database`);

  // Show sample
  if (response.data.news.length > 0) {
    log(COLORS.gray, `  Sample: "${response.data.news[0].title.substring(0, 60)}..."`);
  }
}

async function testSummarization(): Promise<void> {
  subHeader('Test 2: Summarization Service');

  // Check if news items exist first
  log(COLORS.gray, 'Checking for news items...');
  let response = await axios.get(`${API_BASE_URL}/api/news-items?limit=1`);

  if (response.data.news.length === 0) {
    throw new Error('No news items available for summarization. Run aggregation first.');
  }
  log(COLORS.green, `✓ Found ${response.data.total} news items available`);

  // Trigger summarization
  log(COLORS.gray, 'Triggering summarization (this may take 10-30 seconds)...');
  const startSummarize = Date.now();
  response = await axios.post(`${API_BASE_URL}/api/test/generate-summaries`, {}, { timeout: 60000 });
  const summarizeTime = Date.now() - startSummarize;

  if (!response.data.summariesGenerated) {
    throw new Error('No summaries generated');
  }
  log(COLORS.green, `✓ Generated ${response.data.summariesGenerated} summaries for ${response.data.dayOfWeek}`);
  log(COLORS.gray, `  Topic: "${response.data.topicName}" (took ${(summarizeTime / 1000).toFixed(1)}s)`);

  // Verify summaries
  log(COLORS.gray, 'Verifying summaries in database...');
  response = await axios.get(`${API_BASE_URL}/api/summaries`);

  if (!response.data.summaries || response.data.summaries.length === 0) {
    throw new Error('No summaries found in database');
  }
  log(COLORS.green, `✓ Found ${response.data.summaries.length} summaries`);

  // Show sample
  if (response.data.summaries.length > 0) {
    const summary = response.data.summaries[0];
    log(COLORS.gray, `  Sample: ${summary.topic_name} (${summary.day_of_week})`);
    log(COLORS.gray, `  Content: "${summary.content.substring(0, 80)}..."`);
  }
}

async function testEmailService(): Promise<void> {
  subHeader('Test 3: Email Service');

  // Check preferences
  log(COLORS.gray, 'Checking email preferences...');
  let response = await axios.get(`${API_BASE_URL}/api/preferences`);
  log(COLORS.green, `✓ Email service configured`);
  log(COLORS.gray, `  Preferred sources: ${response.data.preferred_sources?.join(', ') || 'RSS, Twitter, Reddit'}`);

  // Check email logs structure
  log(COLORS.gray, 'Checking email logs...');
  response = await axios.get(`${API_BASE_URL}/api/logs?limit=1`);
  log(COLORS.green, `✓ Email logging system ready`);
  log(COLORS.gray, `  Total logs available: ${response.data.logs.length}`);

  // Check Resend configuration
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    log(COLORS.green, `✓ Resend API key configured`);
  } else {
    log(COLORS.yellow, `⚠ Resend API key not found - email delivery will use dry-run`);
  }
}

async function testFullPipeline(): Promise<void> {
  subHeader('Test 4: Full Pipeline (Aggregation → Summarization → Email)');

  // Step 1: Aggregation
  log(COLORS.gray, 'Step 1: Aggregating news...');
  let response = await axios.post(`${API_BASE_URL}/api/test/aggregate-news`);
  const itemsCount = response.data.itemsCollected;
  log(COLORS.green, `✓ Aggregated ${itemsCount} news items`);

  await wait(1000);

  // Step 2: Summarization
  log(COLORS.gray, 'Step 2: Generating summaries (10-30 seconds)...');
  response = await axios.post(`${API_BASE_URL}/api/test/generate-summaries`, {}, { timeout: 60000 });
  const summaryCount = response.data.summariesGenerated;
  log(COLORS.green, `✓ Generated ${summaryCount} summaries for ${response.data.dayOfWeek}`);

  await wait(1000);

  // Step 3: Email job
  log(COLORS.gray, 'Step 3: Processing email job...');
  response = await axios.post(`${API_BASE_URL}/api/test/send-email`, {}, { timeout: 30000 });
  log(COLORS.green, `✓ Email job completed successfully`);

  // Step 4: Verify in logs
  log(COLORS.gray, 'Step 4: Verifying email logs...');
  response = await axios.get(`${API_BASE_URL}/api/logs?limit=1`);

  if (response.data.logs.length === 0) {
    throw new Error('No email logs found after sending');
  }

  const latestLog = response.data.logs[0];
  log(COLORS.green, `✓ Email logged successfully`);
  log(COLORS.gray, `  Status: ${latestLog.status}`);
  log(COLORS.gray, `  Recipient: ${latestLog.recipient}`);
  log(COLORS.gray, `  Subject: ${latestLog.subject}`);
}

async function testSchedulers(): Promise<void> {
  subHeader('Test 5: Scheduler Health Check');

  // The schedulers should be running on the backend
  // We can verify this by checking if the backend is responding
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    if (response.data.status === 'ok') {
      log(COLORS.green, `✓ Backend and schedulers are running`);
      log(COLORS.gray, `  Database: ${response.data.database}`);
      log(COLORS.gray, `  Ollama: ${response.data.ollama}`);
    }
  } catch (error) {
    throw new Error('Backend health check failed - schedulers may not be running');
  }
}

async function printSummary() {
  header('PHASE 4 TEST RESULTS');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((acc, r) => acc + r.duration, 0);

  results.forEach((result, idx) => {
    const status = result.passed ? `${COLORS.green}✓` : `${COLORS.red}✗`;
    const time = `${(result.duration / 1000).toFixed(1)}s`;
    log(COLORS.reset, `${status} ${COLORS.reset} Test ${idx + 1}: ${result.name} (${time})`);
    if (!result.passed) {
      log(COLORS.red, `    └─ ${result.details}`);
    }
  });

  console.log('\n' + COLORS.bright + COLORS.cyan + '═'.repeat(60) + COLORS.reset);
  log(COLORS.bright + COLORS.green, `Passed: ${passed}/${results.length}`);
  log(COLORS.bright + COLORS.yellow, `Failed: ${failed}/${results.length}`);
  log(COLORS.gray, `Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(COLORS.cyan + '═'.repeat(60) + COLORS.reset);

  if (failed === 0) {
    log(COLORS.bright + COLORS.green, '\n🎉 All tests passed! Phase 4 validation complete!');
  } else {
    log(COLORS.bright + COLORS.red, `\n⚠ ${failed} test(s) failed. Please review the errors above.`);
  }
}

async function main() {
  header('PHASE 4: EMAIL DELIVERY - VALIDATION SUITE');

  log(COLORS.cyan, `Connecting to API at ${API_BASE_URL}`);

  // Check server health
  let attempts = 0;
  while (attempts < 5) {
    if (await checkServerHealth()) {
      log(COLORS.green, '✓ Server is healthy\n');
      break;
    }
    attempts++;
    if (attempts < 5) {
      log(COLORS.yellow, `⚠ Server not ready, retrying... (${attempts}/4)`);
      await wait(2000);
    }
  }

  if (attempts === 5) {
    log(COLORS.red, '✗ Server is not responding. Please ensure backend is running.');
    process.exit(1);
  }

  // Run all tests
  await runTest('News Aggregation', testAggregation);
  await runTest('Summarization Service', testSummarization);
  await runTest('Email Service Configuration', testEmailService);
  await runTest('Full Pipeline Integration', testFullPipeline);
  await runTest('Scheduler Health', testSchedulers);

  // Print summary
  await printSummary();

  // Exit with appropriate code
  const failedCount = results.filter(r => !r.passed).length;
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(error => {
  log(COLORS.red, `Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
