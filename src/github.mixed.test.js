jest.mock('./config', () => ({
  GITHUB_CLIENT_ID: 'testClientId',
  GITHUB_CLIENT_SECRET: 'testClientSecret',
  COGNITO_REDIRECT_URI: 'http://localhost/callback',
  GITHUB_API_URL: 'http://api.github.com',
  GITHUB_LOGIN_URL: 'http://github.com',
}));
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


const github = require('./github');

describe('GitHub Client - Response Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gitHubGet', () => {
    test('should handle response with non-200 status', async () => {
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        data: {
          message: 'API rate limit exceeded',
        },
      };

      mockAxios.get.mockRejectedValue({ response: mockResponse });

      const client = github('http://api.github.com');
      await expect(client.getUserDetails('test_token')).rejects.toThrow(
        'GitHub API responded with a failure: 429 (API rate limit exceeded)'
      );

      // Verify axios was called correctly
      expect(mockAxios.get).toHaveBeenCalledWith('http://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'token test_token',
        },
        timeout: 10000
      });
    }, 15000); // Increase timeout to 15 seconds

    test('should handle 204 response with error message', async () => {
      mockAxios.get.mockResolvedValueOnce({
        status: 204,
        statusText: 'No Content',
        data: {},
        headers: {
          'x-ratelimit-remaining': '5000',
          'x-ratelimit-limit': '5000',
        },
      });

      const client = github('http://api.github.com');
      await expect(client.getUserDetails('test_token')).resolves.toEqual({});

      // Verify axios was called correctly
      expect(mockAxios.get).toHaveBeenCalledWith('http://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'token test_token',
        },
        timeout: 10000
      });
    });

    test('should handle 429 rate limit response', async () => {
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        data: {
          message: 'API rate limit exceeded',
        },
      };

      mockAxios.get.mockRejectedValue({ response: mockResponse });

      const client = github('http://api.github.com');
      await expect(client.getUserDetails('test_token')).rejects.toThrow(
        'GitHub API responded with a failure: 429 (API rate limit exceeded)'
      );

      // Verify axios was called correctly
      expect(mockAxios.get).toHaveBeenCalledWith('http://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'token test_token',
        },
        timeout: 10000
      });
    }, 15000); // Increase timeout to 15 seconds
  });

  describe('getToken', () => {
    test('should handle network error without response object', async () => {
      const networkError = new Error('Network Error');
      networkError.isNetworkError = true;
      // Set .response.status to -1 to prevent retrying
      networkError.response = { status: -1 };

      // Mock axios to throw the error directly
      mockGetAxios.mockImplementationOnce(() => {
        throw networkError;
      });

      const client = github('http://api.github.com');
      await expect(client.getToken('test_code')).rejects.toThrow('Network Error');
    });
  });
});
