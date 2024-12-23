const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

// Declare intercept variables
let logger;
let validator;
let rateLimiter;
let processRequest;

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
    
    // Load fresh copies of intercepted modules
    logger = require('../logger');
    validator = require('../../utils/validator');
    rateLimiter = require('../../utils/rate-limiter');
    processRequest = require('./index').processRequest;
    
    // Setup mocks
    rateLimiter.checkLimit = jest.fn();
    rateLimiter.isRateLimitError = jest.fn();
    validator.validate = jest.fn();

    // Setup test data
    mockEvent = {
      path: '/authorize',
      httpMethod: 'GET',
      headers: {},
      body: null
    };
    mockContext = {
      awsRequestId: '123'
    };
    config = {
      allowedMethods: ['GET'],
      requiresRateLimit: true,
      handler: jest.fn().mockReturnValue({
        statusCode: 200,
        body: JSON.stringify({ success: true })
      })
    };
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../../utils/validator')];
    delete require.cache[require.resolve('../../utils/rate-limiter')];
    delete require.cache[require.resolve('./index')];
  });

  it('should handle method not allowed', () => {
    mockEvent.httpMethod = 'POST';

    const response = processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toEqual({
      error: 'method_not_allowed',
      error_description: 'Method POST not allowed',
    });
  });

  it('should handle missing authorization', () => {
    config.requiresAuth = true;

    const response = processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      error: 'unauthorized',
      error_description: 'No valid access token provided',
    });
  });

  it('should handle validation error', () => {
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

    const response = processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: 'invalid_request',
      error_description: 'Validation failed'
    });
  });

  it('should handle rate limit error', () => {
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.statusCode = 429;
    rateLimitError.retryAfter = 60;

    rateLimiter.checkLimit.mockImplementation(() => {
      throw rateLimitError;
    });
    rateLimiter.isRateLimitError.mockReturnValue(true);

    const response = processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('60');
    expect(JSON.parse(response.body)).toEqual({
      error: 'rate_limit_exceeded',
      error_description: 'Rate limit exceeded',
    });
  });

  it('should handle successful request', () => {
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

    config.handler.mockReturnValue(mockResponse);

    const response = processRequest(mockEvent, mockContext, config);

    expect(response).toEqual(mockResponse);
    expect(config.handler).toHaveBeenCalledWith(mockEvent, mockContext);
  });

  it('should handle internal server error', () => {
    config.handler.mockImplementation(() => {
      throw new Error('Internal error');
    });

    const response = processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  });

  it('should handle server error', () => {
    config.handler.mockImplementation(() => {
      throw new Error('Internal error');
    });

    const response = processRequest(mockEvent, mockContext, config);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  });
});
