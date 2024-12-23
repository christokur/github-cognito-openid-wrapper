#!/usr/bin/env node
const minimist = require('minimist');
const { PORT_NUMBER } = require('./mock-oidc-server');

// Parse command line arguments first
const argv = minimist(process.argv.slice(2), {
  string: ['url', 'log-level'],
  boolean: ['help', 'favicon', 'openico'],
  default: {
    url: `http://localhost:${PORT_NUMBER}`,
    'log-level': 'info'
  },
  alias: {
    h: 'help'
  }
});

// Validate no unknown arguments
const validArgs = ['url', 'log-level', 'help', 'favicon', 'openico', 'h', '_'];
const unknownArgs = Object.keys(argv).filter(arg => !validArgs.includes(arg));
if (unknownArgs.length > 0) {
  console.error(`Error: Unknown argument(s): ${unknownArgs.map(arg => `--${arg}`).join(', ')}`);
  process.exit(1);
}

// Set log level before requiring any loggers
process.env.LOG_LEVEL = argv['log-level'];
const logger = require('./test-utils/test-logger');

if (argv.help) {
  console.log(`
Usage: node test-endpoints.js [options]

Options:
  --url        Base URL of the OIDC server (default: http://localhost:${PORT_NUMBER})
  --log-level  Logging level: error, warn, info, debug (default: info)
  --help       Show this help message
  --favicon    Only test favicon endpoint
  --openico    Open favicon.ico in image viewer if valid

Examples:
  # Test local server with default settings
  ./test-endpoints.js

  # Test remote server with debug logging
  ./test-endpoints.js --url https://oidc.example.com --log-level debug

  # Test only favicon endpoint
  ./test-endpoints.js --favicon

  # Test favicon and open it if valid
  ./test-endpoints.js --favicon --openico
`);
  process.exit(0);
}

async function main() {
  try {
    const axios = require('axios');
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const { runTests, displayFaviconReport } = require('./test-utils/test-runner');
    const { testFavicon } = require('./test-utils/endpoint-tester');
    const { ensureServerRunning, stopMockServer } = require('./test-utils/server-manager');

    // Start mock server if needed
    if (argv.url.includes('localhost')) {
      await ensureServerRunning(argv.url, true);
    }

    if (argv.favicon) {
      // Only test favicon
      logger.info('Testing favicon endpoint');
      const { response, analysis } = await testFavicon(argv.url);
      displayFaviconReport(analysis);
      
      if (response.status !== 200 || !analysis.isValidICO) {
        process.exit(1);
      }
    } else {
      // Run full test suite
      const isLocalhost = argv.url.includes('localhost');
      await runTests(argv.url, isLocalhost, {
        openIco: argv.openico
      });
      const { response, analysis } = await testFavicon(argv.url);
      displayFaviconReport(analysis);
    }

    // Stop mock server if we started it
    if (argv.url.includes('localhost')) {
      await stopMockServer(argv.url);
    }
    process.exit(0);
  } catch (error) {
    logger.error('Test execution failed', {
      prefix: 'Process',
      error: error.message
    });
    process.exit(1);
  }
}

main();
