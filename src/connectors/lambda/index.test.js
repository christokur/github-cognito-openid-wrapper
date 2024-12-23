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
      info: jest.fn(),
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
      index.handler(mockEvent, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        statusCode: 405,
        body: JSON.stringify({
          error: 'method_not_allowed',
          error_description: 'Method PUT not allowed',
        }),
      }));
    });

    it('should handle missing authorization', () => {
      mockEvent.path = '/userinfo';
      index.handler(mockEvent, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        statusCode: 401,
        body: JSON.stringify({
          error: 'unauthorized',
          error_description: 'No valid access token provided',
        }),
      }));
    });

    it('should handle validation error', () => {
      validator.validate.mockImplementation(() => {
        throw new Error('Invalid request');
      });
      index.handler(mockEvent, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        statusCode: 400,
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Invalid request',
        }),
      }));
    });

    it('should handle rate limit error', () => {
      mockEvent.path = '/token';
      mockEvent.httpMethod = 'POST';
      rateLimiter.checkLimit.mockImplementation(() => {
        const error = new Error('Rate limit exceeded');
        error.statusCode = 429;
        error.retryAfter = 60;
        throw error;
      });
      index.handler(mockEvent, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        statusCode: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
        body: JSON.stringify({
          error: 'rate_limit_exceeded',
          error_description: 'Rate limit exceeded',
        }),
      }));
    });

    it('should handle successful authorize request', () => {
      const mockResponse = {
        statusCode: 302,
        headers: {
          'Location': 'https://github.com/login',
          'Cache-Control': 'no-store',
        },
      };
      authorize.handler.mockReturnValue(mockResponse);
      index.handler(mockEvent, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        ...mockResponse,
        headers: {
          ...mockResponse.headers,
        },
      }));
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
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      };
      token.handler.mockReturnValue(mockResponse);
      index.handler(mockEvent, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        ...mockResponse,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      }));
    });

    it('should handle server error', () => {
      authorize.handler.mockImplementation(() => {
        throw new Error('Server error');
      });
      index.handler(mockEvent, mockContext, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
        statusCode: 500,
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Internal server error',
        }),
      }));
    });
  });
});
