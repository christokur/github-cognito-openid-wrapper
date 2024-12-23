// Create mock functions
const mockDebug = jest.fn();
const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();
const mockAdd = jest.fn();
const mockCreateLogger = jest.fn(() => ({
  add: mockAdd,
  log: jest.fn(),
  debug: mockDebug,
  info: mockInfo,
  warn: mockWarn,
  error: mockError,
}));

const mockConsoleTransport = jest.fn().mockImplementation(() => ({
  log: jest.fn(),
}));

let mockPrintfFn;

// Mock winston and SplunkTransport
jest.mock('winston', () => {
  // eslint-disable-next-line global-require
  const Transport = require('winston-transport');
  const Console = mockConsoleTransport;

  return {
    createLogger: mockCreateLogger,
    format: {
      combine: jest.fn((...args) => args),
      splat: jest.fn(() => ({
        transform: (info) => {
          // Simple splat implementation for testing
          if (info[Symbol.for('splat')]) {
            const args = info[Symbol.for('splat')];
            info.message = info.message.replace(/%[sdj]/g, (match) => {
              const arg = args.shift();
              if (match === '%j') {
                return JSON.stringify(arg);
              }
              return arg;
            });
          }
          return info;
        },
      })),
      timestamp: jest.fn(() => ({
        transform: (info) => {
          info.timestamp = '2024-12-18T10:54:09.036Z';
          return info;
        },
      })),
      printf: jest.fn((fn) => {
        mockPrintfFn = fn;
        return {
          transform: (info) => fn(info),
        };
      }),
    },
    transports: {
      Console,
    },
    Transport,
  };
});

const mockSplunkTransport = jest.fn((opts) => ({
  opts,
  log: jest.fn((_err, _result, callback) => {
    callback(null);
  }),
}));

jest.mock('winston-splunk-httplogger', () => mockSplunkTransport);

const winston = require('winston');

describe('Logger', () => {
  let logger;
  let winstonInstance;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.SPLUNK_URL;
    delete process.env.SPLUNK_TOKEN;
    delete process.env.SPLUNK_SOURCE;
    delete process.env.SPLUNK_SOURCETYPE;
    delete process.env.SPLUNK_INDEX;

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Printf-style logging', () => {
    beforeEach(() => {
      // eslint-disable-next-line global-require
      logger = require('./logger');
      winstonInstance = require('winston');
    });

    it('should properly format printf-style messages with single placeholder', () => {
      const info = {
        level: 'info',
        message: 'Test message: %s',
        timestamp: '2024-12-18T10:54:09.036Z',
        [Symbol.for('splat')]: ['value1'],
      };

      // Apply the transforms in order
      const splatted = winstonInstance.format.splat().transform(info);
      const timestamped = winstonInstance.format
        .timestamp()
        .transform(splatted);
      const logEntry = mockPrintfFn(timestamped);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'info',
        message: 'Test message: value1',
      });
    });

    it('should properly format printf-style messages with multiple placeholders', () => {
      const info = {
        level: 'debug',
        message: 'Token controller called with code: %s, state: %s, host: %s',
        timestamp: '2024-12-18T10:54:09.036Z',
        [Symbol.for('splat')]: ['abc123', 'xyz789', 'example.com'],
      };

      // Apply the transforms in order
      const splatted = winstonInstance.format.splat().transform(info);
      const timestamped = winstonInstance.format
        .timestamp()
        .transform(splatted);
      const logEntry = mockPrintfFn(timestamped);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'debug',
        message:
          'Token controller called with code: abc123, state: xyz789, host: example.com',
      });
    });

    it('should properly format printf-style messages with JSON placeholder', () => {
      const info = {
        level: 'info',
        message: 'Response data: %j',
        timestamp: '2024-12-18T10:54:09.036Z',
        [Symbol.for('splat')]: [{ key: 'value' }],
      };

      // Apply the transforms in order
      const splatted = winstonInstance.format.splat().transform(info);
      const timestamped = winstonInstance.format
        .timestamp()
        .transform(splatted);
      const logEntry = mockPrintfFn(timestamped);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'info',
        message: 'Response data: {"key":"value"}',
      });
    });
  });

  describe('Structured logging', () => {
    beforeEach(() => {
      // eslint-disable-next-line global-require
      logger = require('./logger');
    });

    it('should properly format object messages', () => {
      const info = {
        level: 'info',
        message: {
          action: 'user_login',
          userId: '123',
          status: 'success',
        },
        timestamp: '2024-12-18T10:54:09.036Z',
      };

      const logEntry = mockPrintfFn(info);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'info',
        action: 'user_login',
        userId: '123',
        status: 'success',
      });
    });

    it('should properly format nested object messages', () => {
      const info = {
        level: 'info',
        message: {
          action: 'token_exchange',
          details: {
            grantType: 'authorization_code',
            scope: 'openid profile',
          },
          status: 'success',
        },
        timestamp: '2024-12-18T10:54:09.036Z',
      };

      const logEntry = mockPrintfFn(info);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'info',
        action: 'token_exchange',
        details: {
          grantType: 'authorization_code',
          scope: 'openid profile',
        },
        status: 'success',
      });
    });

    it('should handle error objects in structured logging', () => {
      const error = new Error('Test error');
      const info = {
        level: 'error',
        message: {
          error: error.message,
          stack: error.stack,
          context: {
            requestId: 'req-123',
          },
        },
        timestamp: '2024-12-18T10:54:09.036Z',
      };

      const logEntry = mockPrintfFn(info);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'error',
        error: 'Test error',
        stack: error.stack,
        context: {
          requestId: 'req-123',
        },
      });
    });

    it('should properly format simple string messages', () => {
      const info = {
        level: 'debug',
        message: {
          message: 'Simple string message',
        },
        timestamp: '2024-12-18T10:54:09.036Z',
      };

      const logEntry = mockPrintfFn(info);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'debug',
        message: 'Simple string message',
      });
    });

    it('should properly format messages with data', () => {
      const info = {
        level: 'debug',
        message: {
          message: 'Message with data',
          data: { foo: 'bar' },
        },
        timestamp: '2024-12-18T10:54:09.036Z',
      };

      const logEntry = mockPrintfFn(info);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'debug',
        message: 'Message with data',
        data: { foo: 'bar' },
      });
    });

    it('should properly format complex nested objects', () => {
      const info = {
        level: 'debug',
        message: {
          message: 'Structured log message',
          data: {
            id: 123,
            nested: {
              value: 'test',
            },
          },
          headers: {
            'Content-Type': 'application/json',
          },
        },
        timestamp: '2024-12-18T10:54:09.036Z',
      };

      const logEntry = mockPrintfFn(info);

      const parsed = JSON.parse(logEntry);
      expect(parsed).toEqual({
        timestamp: '2024-12-18T10:54:09.036Z',
        level: 'debug',
        message: 'Structured log message',
        data: {
          id: 123,
          nested: {
            value: 'test',
          },
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('Transport configuration', () => {
    it('should add Console transport when SPLUNK_URL is not set', async () => {
      // eslint-disable-next-line global-require
      require('./logger');

      expect(mockCreateLogger).toHaveBeenCalled();
      expect(mockAdd).toHaveBeenCalled();
      expect(mockConsoleTransport).toHaveBeenCalled();
    });

    it('should add Splunk transport when SPLUNK_URL is set', async () => {
      process.env.SPLUNK_URL = 'http://splunk.example.com';
      process.env.SPLUNK_TOKEN = 'test-token';
      process.env.SPLUNK_SOURCE = '/test/log/path';
      process.env.SPLUNK_SOURCETYPE = 'test-sourcetype';
      process.env.SPLUNK_INDEX = 'test-index';

      // eslint-disable-next-line global-require
      require('./logger');

      expect(mockSplunkTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          splunk: {
            url: 'http://splunk.example.com',
            token: 'test-token',
            source: '/test/log/path',
            sourcetype: 'test-sourcetype',
            index: 'test-index',
            maxBatchCount: 1,
          },
          format: expect.any(Array),
        }),
      );

      expect(mockAdd).toHaveBeenCalled();
    });
  });
});
