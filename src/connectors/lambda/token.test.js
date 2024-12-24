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
          client_id: 'test_client',
          state: 'test_state',
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

    it('should process request with grant_type successfully', async () => {
      const jsonEvent = {
        body: JSON.stringify({
          code: 'test_code',
          client_id: 'test_client',
          state: 'test_state',
          grant_type: 'authorization_code',
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
        body: 'code=test_code&client_id=test_client&state=test_state',
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

    it('should process form-urlencoded request with grant_type successfully', async () => {
      const formEvent = {
        body: 'code=test_code&client_id=test_client&state=test_state&grant_type=authorization_code',
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
      const result = await token.handler({});
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        error: 'invalid_request',
        error_description: expect.stringContaining('body'),
      });
    });

    it('should handle missing host header', async () => {
      const jsonEvent = {
        body: JSON.stringify({
          code: 'test_code',
          state: 'test_state',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const result = await token.handler(jsonEvent);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        error: 'invalid_request',
        error_description: expect.stringContaining('Host'),
      });
    });

    it('should handle missing required parameters', async () => {
      const jsonEvent = {
        body: JSON.stringify({
          state: 'test_state',
        }),
        headers: {
          'Content-Type': 'application/json',
          Host: 'example.com',
        },
      };

      const result = await token.handler(jsonEvent);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        error: 'invalid_request',
        error_description: expect.stringContaining('code'),
      });
    });

    it('should handle controller errors', async () => {
      const mockControllerInstance = {
        token: jest.fn().mockRejectedValue(new Error('Test error')),
      };
      controllers.mockReturnValue(mockControllerInstance);

      const jsonEvent = {
        body: JSON.stringify({
          code: 'test_code',
          client_id: 'test_client',
          state: 'test_state',
        }),
        headers: {
          'Content-Type': 'application/json',
          Host: 'example.com',
        },
      };

      const result = await token.handler(jsonEvent);
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: 'server_error',
        error_description: 'Test error',
      });
    });
  });
});
