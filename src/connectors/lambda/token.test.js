const { mockValues } = require('../../mocks');
const { OAuthError, errorTypes } = require('../../errors');

// Mock controllers
jest.mock('../controllers', () => {
  const mockToken = jest.fn().mockReturnValue({
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    body: JSON.stringify({
      access_token: 'test_token',
      token_type: 'bearer',
      scope: 'openid user:email',
    }),
  });

  return jest.fn().mockReturnValue({
    token: mockToken,
  });
});

describe('Lambda Token Handler', () => {
  let token;
  let controllers;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    controllers = require('../controllers');
    token = require('./token');
    logger = require('../logger');
  });

  describe('with application/json content type', () => {
    it('should process JSON request successfully', () => {
      const jsonEvent = {
        body: JSON.stringify({
          code: 'test_code',
          state: 'test_state',
          code_verifier: 'test_verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
          Host: 'example.com',
        },
      };

      const result = token.handler(jsonEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        access_token: 'test_token',
        token_type: 'bearer',
        scope: 'openid user:email',
      });
    });
  });

  describe('with application/x-www-form-urlencoded content type', () => {
    it('should process form-urlencoded request successfully', () => {
      const formEvent = {
        body: 'code=test_code&state=test_state&code_verifier=test_verifier',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Host: 'example.com',
        },
      };

      const result = token.handler(formEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        access_token: 'test_token',
        token_type: 'bearer',
        scope: 'openid user:email',
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing body', () => {
      const result = token.handler({
        headers: { Host: 'example.com' },
      });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'invalid_request',
        error_description: 'Request body is required',
      });
    });

    it('should handle missing host header', () => {
      const result = token.handler({
        body: JSON.stringify({
          code: 'test_code',
          state: 'test_state',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'invalid_request',
        error_description: 'Host header is required',
      });
    });

    it('should handle controller errors', () => {
      controllers().token.mockReturnValue({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Test error',
        }),
      });

      const result = token.handler({
        body: JSON.stringify({
          code: 'test_code',
          state: 'test_state',
        }),
        headers: {
          'Content-Type': 'application/json',
          Host: 'example.com',
        },
      });

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: 'server_error',
        error_description: 'Test error',
      });
    });
  });
});
