const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

// Declare intercept variables
let logger;
let rateLimiter;
let validator;
let authorize;
let openIdConfiguration;
let token;
let userinfo;
let jwks;
let favicon;
let index;

describe('Lambda Handler', () => {
  let mockEvent;
  let mockContext;
  let mockCallback;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock logger
    jest.doMock('../logger', () => ({
      debug: jest.fn(),
      error: jest.fn(),
    }));

    // Load modules after reset
    logger = require('../logger');
    rateLimiter = require('../../utils/rate-limiter');
    validator = require('../../utils/validator');
    authorize = require('./authorize');
    openIdConfiguration = require('./open-id-configuration');
    token = require('./token');
    userinfo = require('./userinfo');
    jwks = require('./jwks');
    favicon = require('../../favicon');

    // Create mock functions
    rateLimiter.checkLimit = jest.fn();
    rateLimiter.isRateLimitError = jest.fn();
    validator.validate = jest.fn();

    // Setup mock handlers
    authorize.handler = jest.fn();
    openIdConfiguration.handler = jest.fn();
    token.handler = jest.fn();
    userinfo.handler = jest.fn();
    jwks.handler = jest.fn();
    favicon.handler = jest.fn();

    // Setup default mock event and context
    mockEvent = {
      path: '/authorize',
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
    };
    mockContext = {
      awsRequestId: 'test-request-id',
    };
    mockCallback = jest.fn();

    // Require index after mocking
    index = require('./index');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('../../utils/rate-limiter')];
    delete require.cache[require.resolve('../../utils/validator')];
    delete require.cache[require.resolve('./authorize')];
    delete require.cache[require.resolve('./open-id-configuration')];
    delete require.cache[require.resolve('./token')];
    delete require.cache[require.resolve('./userinfo')];
    delete require.cache[require.resolve('./jwks')];
    delete require.cache[require.resolve('../../favicon')];
    delete require.cache[require.resolve('./index')];
    jest.dontMock('../logger');
  });

  describe('processRequest', () => {
    it('should handle method not allowed', () => {
      mockEvent.httpMethod = 'PUT';
      const response = index.handler(mockEvent, mockContext, mockCallback);

      expect(response.statusCode).toBe(405);
      expect(JSON.parse(response.body)).toEqual({
        error: 'method_not_allowed',
        error_description: 'Method PUT not allowed',
      });
    });

    it('should handle missing authorization', () => {
      mockEvent.path = '/userinfo';
      const response = index.handler(mockEvent, mockContext, mockCallback);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        error: 'unauthorized',
        error_description: 'No valid access token provided',
      });
    });

    it('should handle validation error', () => {
      validator.validate.mockImplementation(() => {
        throw { message: 'Invalid request', errors: ['field is required'] };
      });

      const response = index.handler(mockEvent, mockContext, mockCallback);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'invalid_request',
        error_description: 'Invalid request',
        validation_errors: ['field is required'],
      });
    });

    it('should handle rate limit error', () => {
      rateLimiter.checkLimit.mockImplementation(() => {
        throw new Error('Rate limit exceeded');
      });
      rateLimiter.isRateLimitError.mockReturnValue(true);
      mockEvent.path = '/token';

      const response = index.handler(mockEvent, mockContext, mockCallback);

      expect(response.statusCode).toBe(429);
      expect(response.headers['Retry-After']).toBe('60');
      expect(JSON.parse(response.body)).toEqual({
        error: 'rate_limit_exceeded',
        error_description: 'Rate limit exceeded. Please try again later.',
      });
    });

    it('should handle successful authorize request', () => {
      const mockResponse = {
        statusCode: 302,
        headers: {
          Location: 'https://github.com/login',
        },
      };
      authorize.handler.mockReturnValue(mockResponse);

      const response = index.handler(mockEvent, mockContext, mockCallback);

      expect(response).toEqual({
        ...mockResponse,
        headers: {
          ...mockResponse.headers,
          'Cache-Control': 'no-store',
        },
      });
      expect(authorize.handler).toHaveBeenCalledWith(mockEvent, mockContext);
    });

    it('should handle successful token request', () => {
      mockEvent.path = '/token';
      mockEvent.httpMethod = 'POST';
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({
          access_token: 'test-token',
          token_type: 'Bearer',
        }),
      };
      token.handler.mockReturnValue(mockResponse);

      const response = index.handler(mockEvent, mockContext, mockCallback);

      expect(response).toEqual({
        ...mockResponse,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      });
      expect(token.handler).toHaveBeenCalledWith(mockEvent, mockContext);
      expect(rateLimiter.checkLimit).toHaveBeenCalled();
    });

    it('should handle server error', () => {
      authorize.handler.mockImplementation(() => {
        throw new Error('Internal error');
      });

      const response = index.handler(mockEvent, mockContext, mockCallback);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        error: 'server_error',
        error_description: 'Internal server error',
      });
      expect(logger.error).toHaveBeenCalledWith({
        message: 'Request processing failed',
        error: 'Internal error',
        stack: expect.any(String),
        path: '/authorize',
        requestId: 'test-request-id',
      });
    });
  });
});
