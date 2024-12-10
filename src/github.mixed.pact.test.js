const axios = require('axios');
const github = require('./github');

jest.mock('axios');

describe('GitHub Client - Response Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gitHubGet', () => {
    test('should handle response with non-200 status', async () => {
      // Mock axios to return a proper response object
      const mockResponse = {
        status: 204,
        statusText: 'API rate limit exceeded',
        data: {
          message: 'API rate limit exceeded',
          documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
        },
        headers: {
          'content-type': 'application/json'
        }
      };
      
      axios.mockImplementation(() => Promise.resolve(mockResponse));

      const client = github('http://api.github.com');
      await expect(client.getUserDetails('test_token')).rejects.toThrow(
        'GitHub API responded with a failure: 204 (API rate limit exceeded)'
      );

      // Verify axios was called correctly
      expect(axios).toHaveBeenCalledWith({
        method: 'get',
        url: 'http://api.github.com/user',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'token test_token',
        },
      });
    });
  });

  describe('getToken', () => {
    test('should handle network error without response object', async () => {
      const networkError = new Error('Network Error');
      axios.mockRejectedValue(networkError);

      const client = github('http://api.github.com');
      await expect(client.getToken('test_code')).rejects.toThrow('Network Error');
    });
  });
});
