const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn()
};
const mockGetAxios = jest.fn(() => mockAxios);

// !AI: Leave this alone
const noDelay = () => {
  return 0;
};

// const { exponentialBackoff } = require('./utils/retry');
// Mock the actual retry module that's being used
jest.mock('./utils/retry', () => ({
  ...jest.requireActual('./utils/retry'),
  exponentialBackoff: noDelay
}));
// !AI: Leave this alone

jest.mock('./helpers', () => ({
  getAxios: mockGetAxios,
  NumericDate: jest.requireActual('./helpers').NumericDate
}));


const githubClient = require('./github');
let github;

describe('Authorization URL', () => {
  const mockRedirectUri = 'http://localhost/callback';
  const mockState = 'mock-state';
  const mockNonce = 'mock-nonce';
  const mockCodeChallenge = 'mock-code-challenge';

  beforeAll(() => {
    process.env.GITHUB_CLIENT_ID = 'mock-client-id';
    github = githubClient('https://api.github.com', 'https://github.com');
  });

  it('should generate authorize URL with required parameters', () => {
    const url = github.getAuthorizeUrl(mockState);
    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain(`client_id=${process.env.GITHUB_CLIENT_ID}`);
    expect(url).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
    expect(url).toContain(`state=${mockState}`);
    expect(url).toContain('scope=user%3Aemail');
    expect(url).toContain('response_type=code');
  });

  it('should include nonce when provided', () => {
    const url = github.getAuthorizeUrl(mockState, mockNonce);
    expect(url).toContain(`nonce=${mockNonce}`);
  });

  it('should include PKCE parameters when code challenge is provided', () => {
    const url = github.getAuthorizeUrl(mockState, mockNonce, mockCodeChallenge);
    expect(url).toContain(`code_challenge=${mockCodeChallenge}`);
    expect(url).toContain('code_challenge_method=S256');
  });
});
