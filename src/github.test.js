const mockRateLimiter = {
  checkLimit: jest.fn(),
  updateLimits: jest.fn(),
  isRateLimitError: jest.fn().mockReturnValue(false)
};

jest.mock('./utils/rate-limiter', () => mockRateLimiter);

const mockAxios = jest.fn();
const { getAxios } = require('./helpers');
jest.mock('./helpers', () => ({
  getAxios: jest.fn(() => mockAxios),
  NumericDate: jest.requireActual('./helpers').NumericDate
}));

// Set up environment variables before requiring the module
process.env.GITHUB_CLIENT_ID = 'mock-client-id';
process.env.GITHUB_CLIENT_SECRET = 'mock-client-secret';
process.env.COGNITO_REDIRECT_URI = 'http://localhost/callback';
process.env.GITHUB_API_URL = 'https://api.github.com';
process.env.GITHUB_LOGIN_URL = 'https://github.com';

const github = require('./github');

describe('githubClient', () => {
  const mockClientId = 'mock-client-id';
  const mockClientSecret = 'mock-client-secret';
  const mockRedirectUri = 'http://localhost/callback';
  const mockAccessToken = 'mock-access-token';
  const mockState = 'mock-state';
  const mockNonce = 'mock-nonce';
  const mockCodeChallenge = 'mock-code-challenge';
  const mockVerifier = 'mock-verifier';

  const mockResponse = {
    data: {
      access_token: mockAccessToken,
      token_type: 'bearer',
      scope: 'user:email'
    },
    headers: {},
    status: 200
  };

  const mockUserResponse = {
    data: {
      id: '12345',
      login: 'testuser',
      name: 'Test User'
    },
    headers: {},
    status: 200
  };

  const mockEmailsResponse = {
    data: [
      {
        email: 'test@example.com',
        primary: true,
        verified: true
      }
    ],
    headers: {},
    status: 200
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_CLIENT_ID = mockClientId;
    process.env.GITHUB_CLIENT_SECRET = mockClientSecret;
    process.env.GITHUB_REDIRECT_URI = mockRedirectUri;
    process.env.GITHUB_API_URL = 'https://api.github.com';
    process.env.GITHUB_LOGIN_URL = 'https://github.com';
    mockRateLimiter.isRateLimitError.mockReturnValue(false);
  });

  describe('getAuthorizeUrl', () => {
    it('should generate authorize URL with required parameters', () => {
      const url = github.getAuthorizeUrl(mockState);
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain(`client_id=${mockClientId}`);
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

  describe('getToken', () => {
    it('should exchange code for token successfully', async () => {
      mockAxios.mockResolvedValueOnce(mockResponse);
      const result = await github.getToken('code', mockState, mockVerifier);
      expect(result).toEqual(mockResponse.data);
      expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({
        method: 'post',
        url: 'https://github.com/login/oauth/access_token',
        headers: expect.any(Object),
        data: expect.stringContaining('code=code')
      }));
    }, 30000);

    it('should handle OAuth errors', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.'
          }
        }
      };
      mockAxios.mockRejectedValueOnce(errorResponse);
      await expect(github.getToken('invalid-code', mockState)).rejects.toThrow('The code passed is incorrect or expired.');
    }, 30000);

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.isNetworkError = true;
      mockAxios.mockRejectedValueOnce(networkError);
      await expect(github.getToken('code', mockState)).rejects.toThrow('Empty response received from GitHub');
    }, 30000);
  });

  describe('getUserDetails and getUserEmails', () => {
    it('should fetch user details successfully', async () => {
      mockAxios.mockResolvedValueOnce(mockUserResponse);
      const result = await github.getUserDetails(mockAccessToken);
      expect(result).toEqual(mockUserResponse.data);
      expect(mockRateLimiter.updateLimits).toHaveBeenCalledWith(mockUserResponse.headers);
    }, 30000);

    it('should fetch user emails successfully', async () => {
      mockAxios.mockResolvedValueOnce(mockEmailsResponse);
      const result = await github.getUserEmails(mockAccessToken);
      expect(result).toEqual(mockEmailsResponse.data);
      expect(mockRateLimiter.updateLimits).toHaveBeenCalledWith(mockEmailsResponse.headers);
    }, 30000);

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        response: {
          status: 403,
          data: {
            message: 'API rate limit exceeded'
          },
          headers: {
            'x-ratelimit-remaining': '0'
          }
        }
      };
      mockRateLimiter.isRateLimitError.mockReturnValue(true);
      mockAxios.mockRejectedValueOnce(rateLimitError);
      await expect(github.getUserDetails(mockAccessToken)).rejects.toThrow('GitHub API responded with a failure: 429 (API rate limit exceeded)');
      expect(mockRateLimiter.updateLimits).toHaveBeenCalledWith(rateLimitError.response.headers);
    }, 30000);

    it('should handle API errors with messages in 200 responses', async () => {
      const errorInSuccessResponse = {
        status: 200,
        headers: {},
        data: {
          message: 'Not Found',
          documentation_url: 'https://docs.github.com/rest'
        }
      };
      mockAxios.mockResolvedValueOnce(errorInSuccessResponse);
      await expect(github.getUserDetails(mockAccessToken)).rejects.toThrow('GitHub API responded with a failure: 200 (Not Found)');
    }, 30000);

    it('should handle missing response in error', async () => {
      const networkError = new Error('Empty response received from GitHub');
      networkError.isNetworkError = true;
      mockAxios.mockRejectedValueOnce(networkError);
      await expect(github.getUserDetails(mockAccessToken)).rejects.toThrow('Empty response received from GitHub');
    }, 30000);

    it('should handle errors without data object', async () => {
      const errorWithoutData = {
        response: {
          status: 400,
          statusText: 'Bad Request'
        }
      };
      mockAxios.mockRejectedValueOnce(errorWithoutData);
      await expect(github.getUserDetails(mockAccessToken)).rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request)');
    }, 30000);

    it('should handle errors with data but no message', async () => {
      const errorWithEmptyData = {
        response: {
          status: 400,
          data: {},
          statusText: 'Bad Request'
        }
      };
      mockAxios.mockRejectedValueOnce(errorWithEmptyData);
      await expect(github.getUserDetails(mockAccessToken)).rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request)');
    }, 30000);
  });
});
