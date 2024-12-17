const logger = require('./src/connectors/logger');

// Test string message
logger.debug('Simple string message');

// Test message with interpolation
logger.debug('Message with interpolation: %j', { foo: 'bar' });

// Test object message
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

// Test error object
logger.error({
  message: 'Error occurred',
  error: new Error('Test error'),
  context: {
    requestId: '123-456'
  }
});
