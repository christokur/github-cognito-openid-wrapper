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
          scope: 'scope1 scope2'
        }
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const token = await openid.getTokens(
        'SOME_CODE',
        'SOME_STATE',
        'SOME_HOST',
        'SOME_NONCE'
      );

      expect(token).toEqual({
        access_token: 'SOME_TOKEN',
        id_token: expect.any(String),
        scope: 'openid scope1 scope2',
        token_type: 'bearer'
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
        expect.stringContaining('code=SOME_CODE'),
        expect.any(Object)
      );
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
          'SOME_NONCE'
        )
      ).rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)');

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
        expect.stringContaining('code=bad_code'),
        expect.any(Object)
      );
    });
  });
});
