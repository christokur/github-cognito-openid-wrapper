const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

let Configuration;
let client;

describe('Authorization URL', () => {
  const mockState = 'mock-state';
  const mockNonce = 'mock-nonce';
  const mockCodeChallenge = 'mock-code-challenge';
  const mockRedirectUri = 'http://localhost/callback';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    Configuration = require('./config');
    const github = require('./github');
    client = github(mockValues.GITHUB_API_URL, mockValues.GITHUB_LOGIN_URL);
  });

  it('should generate authorize URL with required parameters', () => {
    const url = client.getAuthorizeUrl(
      Configuration.GITHUB_CLIENT_ID,
      'user:email',
      mockState,
      'code',
    );
    expect(url).toContain(
      `${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize`,
    );
    expect(url).toContain(`client_id=${mockValues.GITHUB_CLIENT_ID}`);
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent(mockRedirectUri)}`,
    );
    expect(url).toContain(`state=${mockState}`);
    expect(url).toContain('scope=user%3Aemail');
    expect(url).toContain('response_type=code');
  });

  it('should include nonce when provided', () => {
    const url = client.getAuthorizeUrl(
      Configuration.GITHUB_CLIENT_ID,
      'user:email',
      mockState,
      'code',
      mockNonce,
    );
    expect(url).toContain(`nonce=${mockNonce}`);
  });

  it('should include PKCE parameters when code challenge is provided', () => {
    const url = client.getAuthorizeUrl(
      Configuration.GITHUB_CLIENT_ID,
      'user:email',
      mockState,
      'code',
      mockNonce,
      mockCodeChallenge,
    );
    expect(url).toContain(`code_challenge=${mockCodeChallenge}`);
    expect(url).toContain('code_challenge_method=S256');
  });
});
