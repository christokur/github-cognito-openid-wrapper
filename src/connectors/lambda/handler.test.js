const logger = require('../logger');
const { formatResponse } = require('./response-utils');

// Mock modules
jest.mock('../logger');
jest.mock('./process-request');

describe('Lambda Handler', () => {
  let mockEvent;
  let mockContext;
  let mockCallback;
  let originalEnv;
  let processRequest;
  let handler;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.NODE_ENV;

    // Reset mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Get fresh mock instance
    processRequest = require('./process-request');

    // Get fresh handler instance
    ({ handler } = require('./index'));

    mockEvent = {
      path: '/authorize',
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        response_type: 'code',
      },
    };

    mockContext = {
      awsRequestId: 'test-request-id',
      getRemainingTimeInMillis: jest.fn().mockReturnValue(10000),
      callbackWaitsForEmptyEventLoop: true,
    };

    mockCallback = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useRealTimers();
    process.env.NODE_ENV = originalEnv;
  });

  it('should handle successful request', async () => {
    const mockResponse = {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };

    processRequest.mockResolvedValue(mockResponse);

    // Call handler and wait for processRequest to resolve
    handler(mockEvent, mockContext, mockCallback);
    await jest.runAllTimersAsync();

    expect(processRequest).toHaveBeenCalledWith(mockEvent, mockContext, expect.any(Object));
    expect(mockCallback).toHaveBeenCalledWith(null, mockResponse);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle missing path', async () => {
    delete mockEvent.path;

    handler(mockEvent, mockContext, mockCallback);
    await jest.runAllTimersAsync();

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 404,
        body: expect.stringContaining('not_found'),
      }),
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle unknown path', async () => {
    mockEvent.path = '/unknown';

    handler(mockEvent, mockContext, mockCallback);
    await jest.runAllTimersAsync();

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 404,
        body: expect.stringContaining('not_found'),
      }),
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout', async () => {
    mockContext.getRemainingTimeInMillis.mockReturnValue(500);
    processRequest.mockImplementation(() => new Promise(() => {}));

    handler(mockEvent, mockContext, mockCallback);
    await jest.advanceTimersByTimeAsync(1000);

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 504,
        body: expect.stringContaining('gateway_timeout'),
      }),
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should include debug info in development', async () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('Test error');
    processRequest.mockRejectedValue(error);

    handler(mockEvent, mockContext, mockCallback);
    await jest.runAllTimersAsync();

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 500,
        body: expect.stringContaining('debug'),
      }),
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle unhandled errors', async () => {
    const error = new Error('Test error');
    processRequest.mockRejectedValue(error);

    handler(mockEvent, mockContext, mockCallback);
    await jest.runAllTimersAsync();

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 500,
        body: expect.stringContaining('server_error'),
      }),
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should cleanup timeout on early response', async () => {
    mockEvent.path = '/unknown';

    handler(mockEvent, mockContext, mockCallback);
    await jest.runAllTimersAsync();

    expect(mockCallback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        statusCode: 404,
        body: expect.stringContaining('not_found'),
      }),
    );
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // Fast-forward time to ensure timeout was cleared
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});
