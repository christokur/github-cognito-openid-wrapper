const { mockAxios } = require('../sharedMocks');
const { mockValues } = require('../mocks');
const { OAuthError, errorTypes } = require('../errors');

let controllers;
let Configuration;
let openid;
let validator;
let logger;

jest.mock('../utils/validator', () => ({
  validate: jest.fn(),
  ValidationError: class ValidationError extends Error {
    constructor(message, field, value) {
      super(message);
      this.name = 'ValidationError';
      this.field = field;
      this.value = value;
    }
  },
  schemas: {
    authorize: {},
    token: {},
    userinfo: {},
  },
}));

describe('Controllers', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Configuration = require('../config');
    openid = require('../openid');
    validator = require('../utils/validator');
    logger = require('./logger');
    controllers = require('./controllers')();

    // Setup mocks after requiring modules
    openid.getAuthorizeUrl = jest.fn();
    openid.getTokens = jest.fn();
    openid.getUserInfo = jest.fn();
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();
  });

  describe('authorize', () => {
    const validInput = {
      client_id: 'mock-client-id',
      scope: 'openid',
      state: 'test-state-12345678',
      response_type: 'code'
    };

    beforeEach(() => {
      validator.validate.mockReturnValue(validInput);
      openid.getAuthorizeUrl.mockReturnValue('https://example.com/auth');
    });

    it('should return redirect response for valid input', () => {
      const result = controllers.authorize(
        validInput.client_id,
        validInput.scope,
        validInput.state,
        validInput.response_type
      );

      expect(validator.validate).toHaveBeenCalledWith('authorize', validInput);
      expect(openid.getAuthorizeUrl).toHaveBeenCalledWith(
        validInput.client_id,
        validInput.scope,
        validInput.state,
        validInput.response_type
      );
      expect(result).toEqual({
        statusCode: 302,
        headers: {
          Location: 'https://example.com/auth',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      });
    });

    it('should handle validation errors', () => {
      const validationError = new validator.ValidationError('Invalid client_id', 'client_id', validInput.client_id);
      validationError.errors = [{
        name: 'ValidationError',
        field: 'client_id',
        value: validInput.client_id,
        message: 'Invalid client_id'
      }];
      validator.validate.mockImplementation(() => { throw validationError; });

      const result = controllers.authorize(
        validInput.client_id,
        validInput.scope,
        validInput.state,
        validInput.response_type
      );

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Invalid client_id',
          validation_errors: [{
            name: 'ValidationError',
            field: 'client_id',
            value: validInput.client_id,
            message: 'Invalid client_id'
          }]
        }),
      });
    });
  });

  describe('token', () => {
    const validInput = {
      code: 'test-code-12345678',
      state: 'test-state-12345678',
      host: 'http://localhost',
      code_verifier: 'test-verifier-12345678901234567890123456789012345678901234'
    };
    const mockHost = 'http://localhost';

    beforeEach(() => {
      validator.validate.mockReturnValue(validInput);
      openid.getTokens.mockReturnValue({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600
      });
    });

    it('should return token response for valid input', () => {
      const result = controllers.token(
        validInput.code,
        validInput.state,
        validInput.host,
        validInput.code_verifier
      );

      expect(validator.validate).toHaveBeenCalledWith('token', {
        code: validInput.code,
        state: validInput.state,
        host: validInput.host,
        code_verifier: validInput.code_verifier
      });
      expect(openid.getTokens).toHaveBeenCalledWith(
        validInput.code,
        validInput.state,
        validInput.host,
        validInput.code_verifier
      );
      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600
        }),
      });
    });

    it('should handle invalid token errors', () => {
      const tokenError = new OAuthError(
        errorTypes.INVALID_GRANT,
        'The code passed is incorrect or expired.'
      );
      openid.getTokens.mockImplementation(() => {
        throw tokenError;
      });

      const result = controllers.token(
        validInput.code,
        validInput.state,
        mockHost,
        validInput.code_verifier
      );

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache'
        },
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'The code passed is incorrect or expired.'
        })
      });
    });

    it('should handle rate limit errors', () => {
      const rateLimitError = new OAuthError(
        errorTypes.SERVER_ERROR,
        'API rate limit exceeded',
        429
      );
      openid.getTokens.mockImplementation(() => {
        throw rateLimitError;
      });

      const result = controllers.token(
        validInput.code,
        validInput.state,
        mockHost,
        validInput.code_verifier
      );

      expect(result).toEqual({
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          'Retry-After': '60'
        },
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'API rate limit exceeded'
        })
      });
    });
  });

  describe('userinfo', () => {
    beforeEach(() => {
      validator.validate.mockReturnValue({ access_token: 'valid-token' });
      openid.getUserInfo.mockReturnValue({
        sub: '12345',
        name: 'Test User',
        email: 'test@example.com'
      });
    });

    it('should return user info for valid token', () => {
      const result = controllers.userinfo('valid-token');

      expect(validator.validate).toHaveBeenCalledWith('userinfo', {
        access_token: 'valid-token'
      });
      expect(openid.getUserInfo).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          sub: '12345',
          name: 'Test User',
          email: 'test@example.com'
        }),
      });
    });

    it('should handle missing authorization header', () => {
      const validationError = new validator.ValidationError('access_token is required', 'access_token');
      validationError.errors = [{
        name: 'ValidationError',
        field: 'access_token',
        message: 'access_token is required'
      }];
      validator.validate.mockImplementation(() => { throw validationError; });

      const result = controllers.userinfo();

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'access_token is required',
          validation_errors: [{
            name: 'ValidationError',
            field: 'access_token',
            message: 'access_token is required'
          }]
        }),
      });
    });

    it('should handle invalid token format', () => {
      const validationError = new validator.ValidationError('access_token contains invalid characters', 'access_token', 'InvalidFormat token');
      validationError.errors = [{
        name: 'ValidationError',
        field: 'access_token',
        value: 'InvalidFormat token',
        message: 'access_token contains invalid characters'
      }];
      validator.validate.mockImplementation(() => { throw validationError; });

      const result = controllers.userinfo('InvalidFormat token');

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'access_token contains invalid characters',
          validation_errors: [{
            name: 'ValidationError',
            field: 'access_token',
            value: 'InvalidFormat token',
            message: 'access_token contains invalid characters'
          }]
        }),
      });
    });
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./controllers')];
    delete require.cache[require.resolve('../openid')];
    delete require.cache[require.resolve('../utils/validator')];
    delete require.cache[require.resolve('./logger')];
    delete require.cache[require.resolve('../config')];
  });
});
