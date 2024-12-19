const qs = require('qs');
const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

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
      mockAxios.post.mockImplementation(async (url, data) => {
        if (data.code === VALID_CODE) {
          return {
            status: 200,
            data: { access_token: 'mock_access_token' },
          };
        }
        return Promise.reject({
          response: {
            status: 400,
            data: {
              error: 'bad_verification_code',
              error_description: 'The code passed is incorrect or expired.',
            },
          },
        });
      });

      const token = await client.getToken(VALID_CODE);
      expect(token).toBe('mock_access_token');
    });

    test('with invalid code', async () => {
      mockAxios.post.mockImplementation(async (url, data) => {
        if (data.code === INVALID_CODE) {
          return Promise.reject({
            response: {
              status: 400,
              data: {
                error: 'bad_verification_code',
                error_description: 'The code passed is incorrect or expired.',
              },
            },
          });
        }
        return Promise.resolve({
          status: 200,
          data: { access_token: 'mock_access_token' },
        });
      });

      await expect(client.getToken(INVALID_CODE))
        .rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)');
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
        'test-code-challenge'
      );

      expect(url).toBe(
        `${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize?client_id=test-client-id&scope=user%3Aemail&state=test-state&response_type=code&redirect_uri=${encodeURIComponent(process.env.COGNITO_REDIRECT_URI)}&nonce=test-nonce&code_challenge=test-code-challenge&code_challenge_method=S256`
      );
    });
  });
});
