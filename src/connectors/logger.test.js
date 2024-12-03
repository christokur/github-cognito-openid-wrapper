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

// Mock winston and SplunkTransport
jest.mock('winston', () => {
  // eslint-disable-next-line global-require
  const Transport = require('winston-transport');
  const Console = mockConsoleTransport;
  class MockTransport extends Transport {
    log(_info, callback) {
      this.emit('logged', _info);
      callback();
    }
  }
  return {
    createLogger: mockCreateLogger,
    format: {
      combine: jest.fn((...args) => args),
      splat: jest.fn(() => 'splat'),
      timestamp: jest.fn(() => 'timestamp'),
      json: jest.fn(() => 'json'),
      simple: jest.fn(() => 'simple'),
      colorize: jest.fn(() => 'colorize'),
    },
    transports: {
      Console,
    },
    Transport: MockTransport,
  };
});

const mockSplunkTransport = jest.fn((opts) => ({
  opts,
  log: jest.fn((_err, _result, callback) => {
    callback(null);
  }),
}));

jest.mock('winston-splunk-httplogger', () => mockSplunkTransport);

describe('Logger', () => {
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

  it('should create logger with console transport when SPLUNK_URL is not set', async () => {
    // eslint-disable-next-line global-require
    require('./logger');

    // Verify winston.createLogger was called
    expect(mockCreateLogger).toHaveBeenCalled();

    // Verify the Console transport was added to the logger
    expect(mockAdd).toHaveBeenCalled();
    expect(mockConsoleTransport).toHaveBeenCalled();
  });

  it('should add Splunk transport when SPLUNK_URL is set', async () => {
    // Set Splunk config
    process.env.SPLUNK_URL = 'http://splunk.example.com';
    process.env.SPLUNK_TOKEN = 'test-token';
    process.env.SPLUNK_SOURCE = '/test/log/path';
    process.env.SPLUNK_SOURCETYPE = 'test-sourcetype';
    process.env.SPLUNK_INDEX = 'test-index';

    // eslint-disable-next-line global-require
    require('./logger');

    // Verify SplunkTransport was instantiated
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
        format: expect.any(Object),
      }),
    );

    // Verify the transport was added to the logger
    expect(mockAdd).toHaveBeenCalled();

    // Verify the logger is properly initialized
    // Removed unused variable
  });
});
