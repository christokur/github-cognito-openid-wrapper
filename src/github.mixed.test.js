jest.mock('./config', () => ({
  GITHUB_CLIENT_ID: 'testClientId',
  GITHUB_CLIENT_SECRET: 'testClientSecret',
  COGNITO_REDIRECT_URI: 'http://localhost/callback',
  GITHUB_API_URL: 'http://api.github.com',
  GITHUB_LOGIN_URL: 'http://github.com',
  GITHUB_API_VERSION: 'v3',
  GITHUB_API_TIMEOUT: 10000
}));

const { mockAxios, mockGetAxios } = require('./sharedMocks');

const Configuration = require('./config');
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
  });

  describe('getToken', () => {
    test('should handle network error without response object', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network Error'));

      const client = github('http://api.github.com');
      await expect(client.getToken('test_code')).rejects.toThrow(
        'Network error occurred while contacting GitHub API'
      );
    });
  });
});
