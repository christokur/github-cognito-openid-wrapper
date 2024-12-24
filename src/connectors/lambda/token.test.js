const { mockValues } = require('../../mocks');
const { OAuthError, errorTypes } = require('../../errors');

// Mock controllers
jest.mock('../controllers', () => {
  const mockToken = jest.fn().mockResolvedValue({
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

// Mock request-utils
jest.mock('./request-utils', () => ({
  parseBody: jest.fn((event) => {
    if (!event || !event.body) {
      return { body: undefined, contentType: '' };
    }

    if (event.headers?.['Content-Type']?.includes('application/x-www-form-urlencoded')) {
      const body = {};
      event.body.split('&').forEach((pair) => {
        const [key, value] = pair.split('=');
        body[key] = value;
      });
      return { body, contentType: 'application/x-www-form-urlencoded' };
    }

    return { body: JSON.parse(event.body), contentType: 'application/json' };
  }),
}));

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
    it('should process JSON request successfully', async () => {
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

      const result = await token.handler(jsonEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        access_token: 'test_token',
        token_type: 'bearer',
        scope: 'openid user:email',
      });
    });
  });

  describe('with application/x-www-form-urlencoded content type', () => {
    it('should process form-urlencoded request successfully', async () => {
      const formEvent = {
        body: 'code=test_code&state=test_state&code_verifier=test_verifier',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Host: 'example.com',
        },
      };

      const result = await token.handler(formEvent);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        access_token: 'test_token',
        token_type: 'bearer',
        scope: 'openid user:email',
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing body', async () => {
      const result = await token.handler({
        headers: { Host: 'example.com' },
      });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'invalid_request',
        error_description: 'Request body is required',
      });
    });

    it('should handle missing host header', async () => {
      const result = await token.handler({
        body: JSON.stringify({
          code: 'test_code',
          state: 'test_state',
        }),
        headers: {},
      });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'invalid_request',
        error_description: 'Host header is required',
      });
    });

    it('should handle controller errors', async () => {
      const mockControllers = require('../controllers');
      mockControllers().token.mockRejectedValue(new Error('Test error'));

      const result = await token.handler({
        body: JSON.stringify({
          code: 'test_code',
          state: 'test_state',
        }),
        headers: { Host: 'example.com' },
      });

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: 'server_error',
        error_description: 'Test error',
      });
    });
  });
});
