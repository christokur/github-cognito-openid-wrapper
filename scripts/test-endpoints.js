#!/usr/bin/env node
const { runTests } = require('./test-utils/test-runner');
const { PORT_NUMBER } = require('./dev-oidc-server');

// Parse command line arguments first
const options = {
  testFilters: [],
  favicon: false,
  openIco: false,
  url: `http://localhost:${PORT_NUMBER}`,
  logLevel: 'info'
};

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  switch (arg) {
    case '--test':
      if (i + 1 < process.argv.length) {
        options.testFilters.push(process.argv[++i]);
      } else {
        console.error('Error: --test requires a test name argument');
        process.exit(1);
      }
      break;
    case '--favicon':
      options.favicon = true;
      break;
    case '--openico':
      options.openIco = true;
      break;
    case '--url':
      if (i + 1 < process.argv.length) {
        options.url = process.argv[++i];
      } else {
        console.error('Error: --url requires a URL argument');
        process.exit(1);
      }
      break;
    case '--log-level':
      if (i + 1 < process.argv.length) {
        options.logLevel = process.argv[++i];
      } else {
        console.error('Error: --log-level requires a level argument');
        process.exit(1);
      }
      break;
    case '--help':
      console.log(`
Usage: node test-endpoints.js [options]

Options:
  --test <n>      Run tests matching the specified name (can be used multiple times)
  --url <url>     Base URL of the OIDC server (default: http://localhost:${PORT_NUMBER})
  --favicon       Run favicon test in addition to other tests
  --openico      Open favicon.ico in image viewer if valid
  --log-level <level> Set logging level (debug, info, warn, error)
  --help         Show this help message

Examples:
  node test-endpoints.js --test "Token POST"
  node test-endpoints.js --favicon
  node test-endpoints.js --url https://oidc.example.com --log-level debug
  node test-endpoints.js --favicon --openico
  `);
      process.exit(0);
      break;
    default:
      if (arg.startsWith('--')) {
        console.error(`Error: Unknown option: ${arg}`);
        process.exit(1);
      }
  }
}

// Set log level
process.env.LOG_LEVEL = options.logLevel;
const logger = require('./test-utils/test-logger');

// Run tests
try {
  const { runTests } = require('./test-utils/test-runner');
  runTests(options.url, options.url.includes('localhost'), {
    testFilters: options.testFilters,
    favicon: options.favicon,
    openIco: options.openIco
  });
} catch (error) {
  logger.error('Test run failed:', error);
  process.exit(1);
}
