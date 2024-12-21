#!/usr/bin/env node
const minimist = require('minimist');
const { PORT_NUMBER } = require('./mock-oidc-server');
delete require.cache[require.resolve('./mock-oidc-server')];
delete require.cache[require.resolve('../src/connectors/logger')];

// Parse command line arguments first
const argv = minimist(process.argv.slice(2), {
  string: ['url', 'log-level'],
  boolean: ['help'],
  default: {
    url: `http://localhost:${PORT_NUMBER}`,
    'log-level': 'info'
  },
  alias: {
    h: 'help'
  }
});

// Set log level before requiring any loggers
process.env.LOG_LEVEL = argv['log-level'];
const logger = require('./test-utils/test-logger');

// Show help and exit if requested
if (argv.help) {
  console.log(`
OIDC Endpoint Test Tool

Tests OIDC endpoints for correct HTTP method handling:
- Discovers endpoints via .well-known/openid-configuration
- Tests /authorize endpoint (GET: 200, other methods: 405)
- Tests /token endpoint (POST: 200, other methods: 405)
- Tests /userinfo endpoint (GET: 401, other methods: 405)

Usage: ./test-endpoints.js [options]

Options:
  --url        Base URL of the OIDC server (default: http://localhost:${PORT_NUMBER})
  --log-level  Logging level: error, warn, info, debug (default: info)
  --help       Show this help message

Examples:
  # Test local server with default settings
  ./test-endpoints.js

  # Test remote server with debug logging
  ./test-endpoints.js --url https://oidc.example.com --log-level debug
`);
  process.exit(0);
}

// Main execution
(async () => {
  try {
    const { runTests } = require('./test-utils/test-runner');
    await runTests(argv.url, argv.url.includes('localhost'));
  } catch (error) {
    logger.error('Test execution failed', {
      prefix: 'Process',
      error: error.message
    });
    process.exit(1);
  }
})();
