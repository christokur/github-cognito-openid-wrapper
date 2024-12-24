const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');
const { OAuthError, errorTypes } = require('../../errors');

// Mock modules
jest.mock('../logger');
jest.mock('./process-request');

describe('Lambda Handler', () => {
  let mockEvent;
  let mockContext;
  let mockCallback;
  let logger;
  let processRequest;
  let handler;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock logger
    logger = require('../logger');
    Object.assign(logger, {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    });

    // Get fresh mock instance
    processRequest = require('./process-request');

    // Get fresh handler instance
    ({ handler } = require('./index'));

    mockEvent = {
      path: '/authorize',
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
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
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should handle method not allowed', async () => {
      mockEvent.httpMethod = 'PUT';
      const error = new OAuthError(errorTypes.INVALID_REQUEST, 'Method PUT not allowed');
      error.statusCode = 405;
      processRequest.mockRejectedValue(error);

      handler(mockEvent, mockContext, mockCallback);
      await jest.runAllTimersAsync();

      expect(mockCallback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          statusCode: 405,
          body: JSON.stringify({
            error: 'invalid_request',
            error_description: 'Method PUT not allowed',
          }),
        }),
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle missing authorization', async () => {
      mockEvent.path = '/userinfo';
      const error = new OAuthError(errorTypes.INVALID_CLIENT, 'No valid access token provided');
      error.statusCode = 401;
      processRequest.mockRejectedValue(error);

      handler(mockEvent, mockContext, mockCallback);
      await jest.runAllTimersAsync();

      expect(mockCallback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          statusCode: 401,
          body: JSON.stringify({
            error: 'invalid_client',
            error_description: 'No valid access token provided',
          }),
        }),
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle validation error', async () => {
      const error = new OAuthError(errorTypes.INVALID_REQUEST, 'Invalid request');
      error.statusCode = 400;
      processRequest.mockRejectedValue(error);

      handler(mockEvent, mockContext, mockCallback);
      await jest.runAllTimersAsync();

      expect(mockCallback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          statusCode: 400,
          body: JSON.stringify({
            error: 'invalid_request',
            error_description: 'Invalid request',
          }),
        }),
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limit error', async () => {
      mockEvent.path = '/token';
      mockEvent.httpMethod = 'POST';
      const error = new OAuthError(errorTypes.SERVER_ERROR, 'Rate limit exceeded');
      error.statusCode = 429;
      error.retryAfter = 60;
      processRequest.mockRejectedValue(error);

      handler(mockEvent, mockContext, mockCallback);
      await jest.runAllTimersAsync();

      expect(mockCallback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          statusCode: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
          body: JSON.stringify({
            error: 'server_error',
            error_description: 'Rate limit exceeded',
          }),
        }),
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle successful authorize request', async () => {
      const mockResponse = {
        statusCode: 302,
        headers: {
          Location: 'https://github.com/login',
          'Cache-Control': 'no-store',
        },
      };
      processRequest.mockResolvedValue(mockResponse);

      handler(mockEvent, mockContext, mockCallback);
      await jest.runAllTimersAsync();

      expect(mockCallback).toHaveBeenCalledWith(null, mockResponse);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle server error', async () => {
      const error = new OAuthError(errorTypes.SERVER_ERROR, 'Internal server error');
      error.statusCode = 500;
      processRequest.mockRejectedValue(error);

      handler(mockEvent, mockContext, mockCallback);
      await jest.runAllTimersAsync();

      expect(mockCallback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({
            error: 'server_error',
            error_description: 'Internal server error',
          }),
        }),
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout error', async () => {
      mockContext.getRemainingTimeInMillis.mockReturnValue(500);
      processRequest.mockImplementation(() => new Promise(() => {}));

      handler(mockEvent, mockContext, mockCallback);
      await jest.advanceTimersByTimeAsync(1000);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Request timed out',
          path: mockEvent.path,
          requestId: mockContext.awsRequestId,
        }),
      );

      expect(mockCallback).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          statusCode: 504,
          body: JSON.stringify({
            error: 'gateway_timeout',
            error_description: 'Request timed out',
          }),
        }),
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });
});
