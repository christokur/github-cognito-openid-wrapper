const { mockValues } = require('./mocks');
require('./mocks');

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

  test('Redirects to the authorization URL', () => {
    const state = 'test-state';
    const nonce = 'test-nonce';

    const url = openid.getAuthorizeUrl(
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
