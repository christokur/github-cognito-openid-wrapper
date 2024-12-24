const qs = require('qs');
const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');
const logger = require('./connectors/logger');

describe('GitHub Client - OAuth Operations', () => {
  let Configuration;
  let client;
  let github;

  beforeEach(() => {
    jest.resetModules();
    Configuration = require('./config');
    github = require('./github');
    client = github(mockValues.GITHUB_API_URL, mockValues.GITHUB_LOGIN_URL);
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./config')];
    delete require.cache[require.resolve('./github')];
    delete require.cache[require.resolve('./connectors/logger')];
  });

  describe('getToken', () => {
    const VALID_CODE = 'valid_code';
    const INVALID_CODE = 'invalid_code';

    test('with valid code', async () => {
      const mockResponse = {
        status: 200,
        data: {
          access_token: 'mock_access_token',
          token_type: 'bearer',
          scope: 'user:email',
        },
      };

      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const token = await client.getToken(VALID_CODE);
      expect(token).toEqual(mockResponse.data);
    });

    test('with invalid code', async () => {
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
          error_uri: 'https://docs.github.com/apps/oauth',
        },
      });

      await expect(client.getToken(INVALID_CODE)).rejects.toThrow(
        'Bad Request - bad_verification_code: The code passed is incorrect or expired.'
      );
    });
  });

  describe('getAuthorizeUrl', () => {
    test('returns a redirect url', () => {
      const url = client.getAuthorizeUrl(
        'test-client-id',
        'user:email',
        'test-state',
        'code',
        'test-nonce',
        'test-code-challenge',
      );

      expect(url).toBe(
        `${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize?client_id=test-client-id&scope=user%3Aemail&state=test-state&response_type=code&redirect_uri=${encodeURIComponent(process.env.COGNITO_REDIRECT_URI)}&nonce=test-nonce&code_challenge=test-code-challenge&code_challenge_method=S256`,
      );
    });
  });
});
