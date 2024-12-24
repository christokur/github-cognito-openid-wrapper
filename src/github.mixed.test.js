const { mockValues } = require('./mocks');
const { mockAxios, mockGetAxios } = require('./sharedMocks');

describe('GitHub Client - Response Handling', () => {
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

      const client = github(mockValues.GITHUB_API_URL);
      await expect(client.getUserDetails('test_token')).rejects.toThrow(
        'GitHub API responded with 429: API rate limit exceeded',
      );

      // Verify axios was called correctly
      expect(mockAxios.get).toHaveBeenCalledWith(
        `${mockValues.GITHUB_API_URL}/user`,
        {
          url: `${mockValues.GITHUB_API_URL}/user`,
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token test_token',
          },
          timeout: 10000,
        },
      );
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

      const client = github(mockValues.GITHUB_API_URL);
      await expect(client.getUserDetails('test_token')).resolves.toEqual({});

      // Verify axios was called correctly
      expect(mockAxios.get).toHaveBeenCalledWith(
        `${mockValues.GITHUB_API_URL}/user`,
        {
          url: `${mockValues.GITHUB_API_URL}/user`,
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token test_token',
          },
          timeout: 10000,
        },
      );
    });
  });

  describe('getToken', () => {
    test('should handle network error without response object', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network Error'));

      const client = github(mockValues.GITHUB_API_URL);
      await expect(client.getToken('test_code')).rejects.toThrow(
        'Network Error',
      );
    });
  });
});
