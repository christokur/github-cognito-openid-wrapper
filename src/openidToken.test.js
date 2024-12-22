const { mockValues } = require('./mocks');
const { mockAxios } = require('./sharedMocks');
require('./mocks');

// Mock AuthorizationService
jest.mock('./services/authorization', () => ({
  getStoredState: jest.fn(() => ({
    codeVerifier: 'SOME_VERIFIER',
    nonce: 'SOME_NONCE'
  }))
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
    test('returns a token', async () => {
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
              login: 'testuser'
            }
          });
        } if (url.endsWith('/user/emails')) {
          return Promise.resolve({
            status: 200,
            data: [{
              email: 'test@example.com',
              primary: true,
              verified: true
            }]
          });
        }
      });

      const token = await openid.getTokens(
        'SOME_CODE',
        'SOME_STATE',
        'SOME_HOST',
        'SOME_VERIFIER'
      );

      expect(token).toEqual({
        access_token: 'SOME_TOKEN',
        id_token: expect.any(String),
        scope: 'openid scope1 scope2',
        token_type: 'bearer'
      });

      const postCall = mockAxios.post.mock.calls[0];
      expect(postCall[0]).toBe(`${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`);
      // Don't test the exact format of the data, just verify the content is correct
      const data = new URLSearchParams(postCall[1]);
      expect(data.get('client_id')).toBe(mockValues.GITHUB_CLIENT_ID);
      expect(data.get('client_secret')).toBe(mockValues.GITHUB_CLIENT_SECRET);
      expect(data.get('code')).toBe('SOME_CODE');
      expect(data.get('redirect_uri')).toBe(mockValues.COGNITO_REDIRECT_URI);
      expect(postCall[2].headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      expect(postCall[2].timeout).toBe(10000);

      // Verify user details and emails were requested
      const getCalls = mockAxios.get.mock.calls;
      expect(getCalls).toHaveLength(2);
      expect(getCalls[0][0]).toMatch(/\/user$/);
      expect(getCalls[1][0]).toMatch(/\/user\/emails$/);
    });
  });

  describe('with a bad code', () => {
    test('fails', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.'
          }
        }
      };

      mockAxios.post.mockRejectedValue(errorResponse);

      await expect(
        openid.getTokens(
          'bad_code',
          'SOME_STATE',
          'SOME_HOST',
          'SOME_VERIFIER'
        )
      ).rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)');

      const postCall = mockAxios.post.mock.calls[0];
      expect(postCall[0]).toBe(`${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`);
      // Don't test the exact format of the data, just verify the content is correct
      const data = new URLSearchParams(postCall[1]);
      expect(data.get('client_id')).toBe(mockValues.GITHUB_CLIENT_ID);
      expect(data.get('client_secret')).toBe(mockValues.GITHUB_CLIENT_SECRET);
      expect(data.get('code')).toBe('bad_code');
      expect(data.get('redirect_uri')).toBe(mockValues.COGNITO_REDIRECT_URI);
      expect(postCall[2].headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
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
        error: jest.fn()
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
        arrayBuffers: 16171
      });
    });

    afterEach(() => {
      jest.resetModules();
      process.memoryUsage = originalMemoryUsage;
    });

    test('throws error when code is missing', () => {
      expect(() => openid.getTokens(null, 'state', 'host', 'verifier'))
        .toThrow('The code parameter is required');
    });

    test('logs and rethrows error from token exchange with memory usage', async () => {
      const mockError = new Error('Token exchange failed');
      mockAxios.post.mockRejectedValue(mockError);

      await expect(openid.getTokens('code', 'state', 'host', 'verifier'))
        .rejects.toThrow('Network error occurred while contacting GitHub API');

      // Verify all error logs in the chain
      const errorCalls = logger.error.mock.calls;
      expect(errorCalls.length).toBe(4);

      // First call - GitHub request failed
      expect(errorCalls[0][0]).toMatchObject({
        message: 'GitHub request failed',
        error: expect.objectContaining({
          message: 'Token exchange failed'
        })
      });

      // Second call - Network error occurred
      expect(errorCalls[1][0]).toMatchObject({
        message: 'Network error occurred',
        error: 'Token exchange failed'
      });

      // Third call - Error in getToken
      expect(errorCalls[2][0]).toBe('Error in getToken:');
      expect(errorCalls[2][1]).toBeInstanceOf(Error);

      // Fourth call - Failed to process token exchange with memory usage
      expect(errorCalls[3][0]).toMatchObject({
        message: 'Failed to process token exchange',
        error: 'Network error occurred while contacting GitHub API',
        memoryUsage: {
          rss: 123456,
          heapTotal: 78910,
          heapUsed: 11213,
          external: 14151,
          arrayBuffers: 16171
        }
      });

      // Verify process.memoryUsage was called
      expect(process.memoryUsage).toHaveBeenCalled();
    });
  });
});
