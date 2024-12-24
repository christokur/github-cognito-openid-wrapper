const { mockValues } = require('./mocks');
require('./mocks');

jest.mock('./github', () => jest.fn().mockImplementation(() => ({
    getAuthorizeUrl: jest.fn().mockReturnValue(`${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize?client_id=${mockValues.GITHUB_CLIENT_ID}&scope=user%3Aemail&state=test-state&response_type=code&redirect_uri=${encodeURIComponent(mockValues.COGNITO_REDIRECT_URI)}&nonce=test-nonce&code_challenge=test-code-challenge&code_challenge_method=S256`),
    getApiEndpoints: jest.fn().mockReturnValue({
      userDetails: `${mockValues.GITHUB_API_URL}/user`,
      userEmails: `${mockValues.GITHUB_API_URL}/user/emails`,
      oauthToken: `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
      oauthAuthorize: `${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize`,
    }),
  })));

jest.mock('./utils/pkce', () => ({
  generateCodeVerifier: jest.fn().mockReturnValue('test-code-verifier'),
  generateCodeChallenge: jest.fn().mockReturnValue('test-code-challenge'),
  storeCodeVerifier: jest.fn(),
}));

describe('openid domain layer - Authorization', () => {
  let openid;
  let originalEnv;

  beforeEach(() => {
    // Clear the require cache to ensure fresh config
    jest.resetModules();
    openid = require('./openid');
  });

  afterEach(() => {
    // Restore original env vars
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test('Redirects to the authorization URL', async () => {
    const state = 'test-state';
    const nonce = 'test-nonce';

    const url = await openid.getAuthorizeUrl(
      mockValues.GITHUB_CLIENT_ID,
      'user:email',
      state,
      'code',
      nonce,
    );

    expect(url).toContain(
      `${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize`,
    );
    expect(url).toContain(`client_id=${mockValues.GITHUB_CLIENT_ID}`);
    expect(url).toContain('scope=user%3Aemail');
    expect(url).toContain(`state=${state}`);
    expect(url).toContain('response_type=code');
    expect(url).toContain(`nonce=${nonce}`);
  });
});
