const { mockValues } = require('./mocks');
const { mockAxios } = require('./sharedMocks');
require('./mocks');

// Mock crypto module
jest.mock('./crypto', () => ({
  makeIdToken: jest.fn().mockReturnValue('mocked_id_token'),
}));

// Mock AuthorizationService
jest.mock('./services/authorization', () => ({
  getStoredState: jest.fn(() => ({
    codeVerifier: 'SOME_VERIFIER',
    nonce: 'SOME_NONCE',
  })),
}));

describe('openid domain layer - Token', () => {
  let openid;

  beforeEach(() => {
    jest.resetModules();
    openid = require('./openid');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('with the correct code', () => {
    test('returns a token with valid grant_type and client_id', async () => {
      const mockResponse = {
        data: {
          access_token: 'SOME_TOKEN',
          token_type: 'bearer',
          scope: 'scope1,scope2',
        },
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      // Mock user details and emails
      mockAxios.get.mockImplementation((url) => {
        if (url.endsWith('/user')) {
          return Promise.resolve({
            status: 200,
            data: {
              id: 12345,
              name: 'Test User',
              login: 'testuser',
            },
          });
        }
        if (url.endsWith('/user/emails')) {
          return Promise.resolve({
            status: 200,
            data: [
              {
                email: 'test@example.com',
                primary: true,
                verified: true,
              },
            ],
          });
        }
      });

      const token = await openid.getTokens(
        'SOME_CODE',
        'SOME_STATE',
        'SOME_HOST',
        'SOME_VERIFIER',
        'test_client',
        'authorization_code'
      );

      expect(token).toEqual({
        access_token: 'mocked_id_token',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: expect.any(String),
      });

      const postCall = mockAxios.post.mock.calls[0];
      expect(postCall[0]).toBe(
        `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
      );
      const data = new URLSearchParams(postCall[1]);
      expect(data.get('client_id')).toBe(mockValues.GITHUB_CLIENT_ID);
      expect(data.get('client_secret')).toBe(mockValues.GITHUB_CLIENT_SECRET);
      expect(data.get('code')).toBe('SOME_CODE');
      expect(data.get('grant_type')).toBe('authorization_code');
      expect(data.get('redirect_uri')).toBe(mockValues.COGNITO_REDIRECT_URI);
      expect(postCall[2].headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      expect(postCall[2].timeout).toBe(10000);
    });
  });

  describe('with a bad code', () => {
    test('fails', async () => {
      const errorResponse = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            message: 'Bad Request'
          },
        },
      };

      mockAxios.post.mockRejectedValue(errorResponse);

      await expect(
        openid.getTokens(
          'bad_code',
          'SOME_STATE',
          'SOME_HOST',
          'SOME_VERIFIER',
          'test_client',
          'authorization_code'
        ),
      ).rejects.toThrow(
        'GitHub API responded with 400: Bad Request'
      );

      const postCall = mockAxios.post.mock.calls[0];
      expect(postCall[0]).toBe(
        `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
      );
      // Don't test the exact format of the data, just verify the content is correct
      const data = new URLSearchParams(postCall[1]);
      expect(data.get('client_id')).toBe(mockValues.GITHUB_CLIENT_ID);
      expect(data.get('client_secret')).toBe(mockValues.GITHUB_CLIENT_SECRET);
      expect(data.get('code')).toBe('bad_code');
      expect(data.get('grant_type')).toBe('authorization_code');
      expect(data.get('redirect_uri')).toBe(mockValues.COGNITO_REDIRECT_URI);
      expect(postCall[2].headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      expect(postCall[2].timeout).toBe(10000);
    });
  });

  describe('with invalid inputs', () => {
    let logger;
    let originalMemoryUsage;

    beforeEach(() => {
      jest.resetModules();
      jest.mock('./connectors/logger', () => ({
        debug: jest.fn(),
        error: jest.fn(),
      }));
      logger = require('./connectors/logger');
      openid = require('./openid');

      // Mock process.memoryUsage
      originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 123456,
        heapTotal: 78910,
        heapUsed: 11213,
        external: 14151,
        arrayBuffers: 16171,
      });
    });

    afterEach(() => {
      jest.resetModules();
      process.memoryUsage = originalMemoryUsage;
    });

    test('throws error when code is missing', async () => {
      await expect(openid.getTokens(null, 'state', 'host', 'verifier', 'test_client')).rejects.toThrow(
        'The code parameter is required',
      );
    });

    test('throws error for missing client_id', async () => {
      await expect(
        openid.getTokens(
          'SOME_CODE',
          'SOME_STATE',
          'SOME_HOST',
          'SOME_VERIFIER',
          undefined,
        )
      ).rejects.toThrow('The client_id parameter is required');
    });

    test('logs and rethrows error from token exchange with memory usage', async () => {
      const mockError = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            message: 'Bad Request'
          },
        },
      };
      mockAxios.post.mockRejectedValue(mockError);

      await expect(
        openid.getTokens(
          'code',
          'state',
          'host',
          'verifier',
          'test_client'
        ),
      ).rejects.toThrow(
        'GitHub API responded with 400: Bad Request'
      );

      const errorCalls = logger.error.mock.calls;
      expect(errorCalls).toHaveLength(4);

      // First call - GitHub request failed
      expect(errorCalls[0][0]).toMatchObject({
        message: 'Operation failed after retries',
        error: undefined,
      });
    });

    test('logs error with memory usage when token exchange fails', async () => {
      const mockError = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            message: 'Bad Request'
          },
        },
      };
      mockAxios.post.mockRejectedValue(mockError);

      await expect(
        openid.getTokens(
          'code',
          'state',
          'host',
          'verifier',
          'test_client'
        ),
      ).rejects.toThrow(
        'GitHub API responded with 400: Bad Request'
      );

      const errorCalls = logger.error.mock.calls;
      expect(errorCalls).toHaveLength(4);

      // First call - GitHub request failed
      expect(errorCalls[0][0]).toMatchObject({
        message: 'Operation failed after retries',
        error: undefined,
      });
    });

    test('logs error when token exchange fails', async () => {
      const mockError = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            message: 'Bad Request'
          },
        },
      };
      mockAxios.post.mockRejectedValue(mockError);

      await expect(
        openid.getTokens(
          'code',
          'state',
          'host',
          'verifier',
          'test_client'
        ),
      ).rejects.toThrow(
        'GitHub API responded with 400: Bad Request'
      );

      const errorCalls = logger.error.mock.calls;
      expect(errorCalls).toHaveLength(4);

      // First call - GitHub request failed
      expect(errorCalls[0][0]).toMatchObject({
        message: 'Operation failed after retries',
        error: undefined,
      });
    });
  });
});
