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
      expect(postCall[1]).toEqual({
        client_id: mockValues.GITHUB_CLIENT_ID,
        client_secret: mockValues.GITHUB_CLIENT_SECRET,
        code: 'SOME_CODE',
        redirect_uri: mockValues.COGNITO_REDIRECT_URI
      });
      expect(postCall[2].headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      expect(postCall[2].timeout).toBe(10000);
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
      expect(postCall[1]).toEqual({
        client_id: mockValues.GITHUB_CLIENT_ID,
        client_secret: mockValues.GITHUB_CLIENT_SECRET,
        code: 'bad_code',
        redirect_uri: mockValues.COGNITO_REDIRECT_URI
      });
      expect(postCall[2].headers).toEqual({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      expect(postCall[2].timeout).toBe(10000);
    });
  });
});
