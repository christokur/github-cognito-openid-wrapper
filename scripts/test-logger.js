#!/usr/bin/env node

// Parse command line arguments
const args = process.argv.slice(2);
const validLogLevels = ['error', 'warn', 'info', 'debug'];

if (args.includes('-h') || args.includes('--help')) {
  console.log(`
Usage: ./test-logger.js [log_level]

Arguments:
  log_level    Optional. One of: ${validLogLevels.join(', ')}
               Defaults to 'info' if not specified

Examples:
  ./test-logger.js              # Uses default 'info' level
  ./test-logger.js debug        # Shows all log levels including debug
  ./test-logger.js error        # Shows only error logs
  `);
  process.exit(0);
}

// Set log level from CLI argument or default to 'info'
const logLevel = args[0]?.toLowerCase();
if (logLevel && !validLogLevels.includes(logLevel)) {
  console.error(`Invalid log level: ${logLevel}`);
  console.error(`Valid levels are: ${validLogLevels.join(', ')}`);
  process.exit(1);
}

process.env.LOG_LEVEL = logLevel || 'info';
const logger = require('../src/connectors/logger');

console.log('\n=== Printf-style logging examples ===\n');

// Single placeholder
logger.info('Test message: %s', 'value1');

// Multiple placeholders
logger.debug('Token controller called with code: %s, state: %s, host: %s', 
  'abc123', 'xyz789', 'example.com');

// JSON placeholder
logger.info('Response data: %j', { key: 'value' });

console.log('\n=== Structured logging examples ===\n');

// Object message
logger.info({
  action: 'user_login',
  userId: '123',
  status: 'success'
});

// Nested object message
logger.info({
  action: 'token_exchange',
  details: {
    grantType: 'authorization_code',
    scope: 'openid profile'
  },
  status: 'success'
});

// Error object
try {
  throw new Error('Test error');
} catch (error) {
  logger.error({
    error: error.message,
    stack: error.stack,
    context: {
      requestId: 'req-123'
    }
  });
}

// Simple string message
logger.debug({
  message: 'Simple string message'
});

// Message with data
logger.debug({
  message: 'Message with data',
  data: { foo: 'bar' }
});

// Complex nested objects
logger.debug({
  message: 'Structured log message',
  data: {
    id: 123,
    nested: {
      value: 'test'
    }
  },
  headers: {
    'Content-Type': 'application/json'
  }
});
