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
    openid.getJwks = jest.fn();
    openid.getConfigFor = jest.fn();
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();
  });

  describe('authorize', () => {
    const validInput = {
      client_id: 'mock-client-id',
      scope: 'openid',
      state: 'test-state-12345678',
      response_type: 'code',
    };

    beforeEach(() => {
      validator.validate.mockReturnValue(validInput);
      openid.getAuthorizeUrl.mockReturnValue('https://example.com/auth');
    });

    it('should return redirect response for valid input', async () => {
      const result = await controllers.authorize(
        validInput.client_id,
        validInput.scope,
        validInput.state,
        validInput.response_type,
      );

      expect(validator.validate).toHaveBeenCalledWith('authorize', validInput);
      expect(openid.getAuthorizeUrl).toHaveBeenCalledWith(
        validInput.client_id,
        validInput.scope,
        validInput.state,
        validInput.response_type,
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

    it('should handle validation errors', async () => {
      const validationError = new validator.ValidationError(
        'Invalid client_id',
        'client_id',
        validInput.client_id,
      );
      validationError.errors = [
        {
          name: 'ValidationError',
          field: 'client_id',
          value: validInput.client_id,
          message: 'Invalid client_id',
        },
      ];
      validator.validate.mockImplementation(() => {
        throw validationError;
      });

      const result = await controllers.authorize(
        validInput.client_id,
        validInput.scope,
        validInput.state,
        validInput.response_type,
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
          validation_errors: [
            {
              name: 'ValidationError',
              field: 'client_id',
              value: validInput.client_id,
              message: 'Invalid client_id',
            },
          ],
        }),
      });
    });

    it('should handle rate limit errors', async () => {
      openid.getAuthorizeUrl.mockRejectedValue(new Error('rate limit exceeded'));

      const result = await controllers.authorize(
        validInput.client_id,
        validInput.scope,
        validInput.state,
        validInput.response_type,
      );

      expect(result).toEqual({
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          'Retry-After': '60',
        },
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'rate limit exceeded',
        }),
      });
    });
  });

  describe('token', () => {
    const validInput = {
      code: 'test-code-12345678',
      state: 'test-state-12345678',
      host: 'http://localhost',
      code_verifier:
        'test-verifier-12345678901234567890123456789012345678901234',
      client_id: 'test-client-id',
    };
    const mockHost = 'http://localhost';

    beforeEach(() => {
      validator.validate.mockReturnValue(validInput);
      openid.getTokens.mockReturnValue({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    });

    it('should return token response for valid input', async () => {
      const result = await controllers.token(
        validInput.code,
        validInput.state,
        validInput.host,
        validInput.code_verifier,
        validInput.client_id,
      );

      expect(validator.validate).toHaveBeenCalledWith('token', {
        code: validInput.code,
        state: validInput.state,
        host: validInput.host,
        code_verifier: validInput.code_verifier,
        client_id: validInput.client_id,
      });
      expect(openid.getTokens).toHaveBeenCalledWith(
        validInput.code,
        validInput.state,
        validInput.host,
        validInput.code_verifier,
        validInput.client_id,
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
          expires_in: 3600,
        }),
      });
    });

    it('should handle invalid token errors', async () => {
      const tokenError = new OAuthError(
        errorTypes.INVALID_GRANT,
        'The code passed is incorrect or expired.',
        400
      );
      openid.getTokens.mockRejectedValue(tokenError);

      const result = await controllers.token(
        'invalid-code',
        validInput.state,
        mockHost,
        validInput.code_verifier,
        validInput.client_id,
      );

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'The code passed is incorrect or expired.',
        }),
      });
    });

    it('should handle rate limit errors', async () => {
      openid.getTokens.mockRejectedValue(new Error('rate limit exceeded'));

      const result = await controllers.token(
        validInput.code,
        validInput.state,
        mockHost,
        validInput.code_verifier,
        validInput.client_id,
      );

      expect(result).toEqual({
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          'Retry-After': '60',
        },
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'rate limit exceeded',
        }),
      });
    });
  });

  describe('userinfo', () => {
    const validToken = 'valid-token';
    const mockUserInfo = {
      sub: '12345',
      email: 'test@example.com',
    };

    beforeEach(() => {
      validator.validate.mockReturnValue({ access_token: validToken });
      openid.getUserInfo.mockResolvedValue(mockUserInfo);
    });

    it('should return user info for valid token', async () => {
      const result = await controllers.userinfo(validToken);

      expect(validator.validate).toHaveBeenCalledWith('userinfo', {
        access_token: validToken,
      });
      expect(openid.getUserInfo).toHaveBeenCalledWith(validToken);
      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(mockUserInfo),
      });
    });

    it('should handle missing authorization header', async () => {
      validator.validate.mockImplementation(() => {
        throw new Error('required parameter: access_token');
      });

      const result = await controllers.userinfo(undefined);

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'required parameter: access_token',
        }),
      });
    });

    it('should handle invalid token format', async () => {
      openid.getUserInfo.mockRejectedValue(new Error('invalid token'));

      const result = await controllers.userinfo('invalid-token');

      expect(result).toEqual({
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'invalid token',
        }),
      });
    });
  });

  it('should handle GitHub bad credentials error', async () => {
    validator.validate.mockReturnValue({ access_token: 'invalid-token' });
    openid.getUserInfo.mockRejectedValue(new Error('GitHub API responded with 401: Bad credentials'));

    const result = await controllers.userinfo('invalid-token');

    expect(result).toEqual({
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({
        error: 'invalid_grant',
        error_description: 'GitHub API responded with 401: Bad credentials',
      }),
    });
  });

  describe('jwks', () => {
    const mockJwks = {
      keys: [
        {
          kty: 'RSA',
          kid: 'test-key-id',
          n: 'test-modulus',
          e: 'AQAB',
        },
      ],
    };

    beforeEach(() => {
      openid.getJwks.mockResolvedValue(mockJwks);
    });

    it('should return JWKS for successful request', async () => {
      const result = await controllers.jwks();

      expect(openid.getJwks).toHaveBeenCalled();
      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
        },
        body: JSON.stringify(mockJwks),
      });
    });

    it('should handle JWKS retrieval errors', async () => {
      const error = new Error('Failed to get public key');
      openid.getJwks.mockRejectedValue(error);

      const result = await controllers.jwks();

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Failed to get public key',
        }),
      });
    });
  });

  describe('openIdConfiguration', () => {
    const mockHost = 'http://localhost';
    const mockConfig = {
      issuer: 'http://localhost',
      authorization_endpoint: 'http://localhost/authorize',
      token_endpoint: 'http://localhost/token',
      userinfo_endpoint: 'http://localhost/userinfo',
      jwks_uri: 'http://localhost/.well-known/jwks.json',
    };

    beforeEach(() => {
      openid.getConfigFor.mockResolvedValue(mockConfig);
    });

    it('should return OpenID configuration for valid host', async () => {
      const result = await controllers.openIdConfiguration(mockHost);

      expect(openid.getConfigFor).toHaveBeenCalledWith(mockHost);
      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
        },
        body: JSON.stringify(mockConfig),
      });
    });

    it('should handle missing host', async () => {
      const error = new OAuthError(
        errorTypes.INVALID_REQUEST,
        'Host is required',
        400
      );
      openid.getConfigFor.mockRejectedValue(error);

      const result = await controllers.openIdConfiguration();

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Host is required',
        }),
      });
    });

    it('should handle configuration retrieval errors', async () => {
      const error = new Error('Failed to get configuration');
      openid.getConfigFor.mockRejectedValue(error);

      const result = await controllers.openIdConfiguration(mockHost);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Failed to get configuration',
        }),
      });
    });
  });
});
