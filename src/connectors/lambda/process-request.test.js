const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

// Declare intercept variables
let logger;
let validator;
let rateLimiter;
let retry;
let formatResponse;
let processRequest;
let requestUtils;

describe('processRequest', () => {
  let mockEvent;
  let mockContext;
  let config;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    if (mockAxios.reset) {
      mockAxios.reset();
    }

    // Setup mocks first
    formatResponse = jest.fn(response => response);
    jest.mock('./index', () => ({
      formatResponse,
    }));

    // Load fresh copies of intercepted modules
    logger = require('../logger');
    validator = require('../../utils/validator');
    rateLimiter = require('../../utils/rate-limiter');
    retry = require('../../utils/retry');
    requestUtils = require('./request-utils');
    processRequest = require('./process-request');

    // Setup mocks
    rateLimiter.checkLimit = jest.fn();
    rateLimiter.isRateLimitError = jest.fn();
    validator.validate = jest.fn();
    retry.withRetry = jest.fn(fn => fn()); // Execute the function immediately
    requestUtils.getParameters = jest.fn().mockReturnValue({});

    // Setup test data
    mockEvent = {
      path: '/authorize',
      httpMethod: 'GET',
      headers: {},
      body: null,
    };
    mockContext = {
      awsRequestId: '123',
    };
    config = {
      allowedMethods: ['GET'],
      requiresRateLimit: true,
      handler: jest.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      }),
    };
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../../utils/validator')];
    delete require.cache[require.resolve('../../utils/rate-limiter')];
    delete require.cache[require.resolve('../../utils/retry')];
    delete require.cache[require.resolve('./request-utils')];
    delete require.cache[require.resolve('./process-request')];
    delete require.cache[require.resolve('./index')];
  });

  it('should handle method not allowed', async () => {
    mockEvent.httpMethod = 'POST';

    const response = await processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toEqual({
      error: 'method_not_allowed',
      error_description: 'Method POST not allowed',
    });
  });

  it('should handle missing authorization', async () => {
    config.requiresAuth = true;

    const response = await processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      error: 'unauthorized',
      error_description: 'No valid access token provided',
    });
  });

  it('should handle validation error', async () => {
    config.schema = 'test';

    validator.validate.mockImplementation(() => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.statusCode = 400;
      error.code = 'invalid_request';
      error.field = 'testField';
      error.value = 'testValue';
      throw error;
    });

    const response = await processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: 'invalid_request',
      error_description: 'Validation failed',
    });
  });

  it('should handle rate limit error', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.statusCode = 429;
    rateLimitError.retryAfter = 60;

    rateLimiter.checkLimit.mockRejectedValue(rateLimitError);
    rateLimiter.isRateLimitError.mockReturnValue(true);

    const response = await processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('60');
    expect(JSON.parse(response.body)).toEqual({
      error: 'rate_limit_exceeded',
      error_description: 'Rate limit exceeded',
    });
  });

  it('should handle successful request', async () => {
    const mockResponse = {
      statusCode: 302,
      headers: {
        Location: 'https://github.com/login',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Max-Age': '86400',
      },
    };

    config.handler.mockResolvedValue(mockResponse);

    const response = await processRequest(mockEvent, mockContext, config);

    expect(response).toEqual(mockResponse);
    expect(config.handler).toHaveBeenCalledWith(mockEvent, mockContext);
  });

  it('should handle server error', async () => {
    config.handler.mockRejectedValue(new Error('Internal error'));

    const response = await processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  });
});
