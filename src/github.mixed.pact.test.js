const axios = require('axios');
const github = require('./github');

jest.mock('axios', () => {
  return {
    create: jest.fn(() => {
      return {
        get: jest.fn(),
        post: jest.fn(),
        interceptors: {
          request: {
            use: jest.fn(),
            eject: jest.fn()
          },
          response: {
            use: jest.fn(),
            eject: jest.fn()
          }
        }
      };
    })
  };
});

describe('GitHub Client - Response Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gitHubGet', () => {
    test('should handle response with non-200 status', async () => {
      // Mock axios to return a proper response object
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        data: {
          message: 'API rate limit exceeded',
          documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
        },
        headers: {
          'content-type': 'application/json'
        }
      };
      
      axios.create().get.mockRejectedValue({ response: mockResponse });

      const client = github('http://api.github.com');
      await expect(client.getUserDetails('test_token')).rejects.toThrow(
        'GitHub API responded with a failure: 429 (API rate limit exceeded)'
      );

      // Verify axios was called correctly
      expect(axios.create().get).toHaveBeenCalledWith({
        method: 'get',
        url: 'http://api.github.com/user',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'token test_token',
        },
        timeout: 10000
      });
    }, 15000); // Increase timeout to 15 seconds

    test('should handle 204 response with error message', async () => {
      // Mock axios to return a 204 with error message
      const mockResponse = {
        status: 204,
        statusText: 'No Content',
        data: {
          message: 'API rate limit exceeded',
          documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
        },
        headers: {
          'content-type': 'application/json'
        }
      };
      
      axios.create().get.mockResolvedValue(mockResponse);

      const client = github('http://api.github.com');
      await expect(client.getUserDetails('test_token')).rejects.toThrow(
        'GitHub API responded with a failure: 204 (API rate limit exceeded)'
      );

      // Verify axios was called correctly
      expect(axios.create().get).toHaveBeenCalledWith({
        method: 'get',
        url: 'http://api.github.com/user',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'token test_token',
        },
        timeout: 10000
      });
    });

    test('should handle 429 rate limit response', async () => {
      // Mock axios to return a 429 rate limit error
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        data: {
          message: 'API rate limit exceeded',
          documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
        },
        headers: {
          'content-type': 'application/json'
        }
      };
      
      axios.create().get.mockRejectedValue({ response: mockResponse });

      const client = github('http://api.github.com');
      await expect(client.getUserDetails('test_token')).rejects.toThrow(
        'GitHub API responded with a failure: 429 (API rate limit exceeded)'
      );

      // Verify axios was called correctly
      expect(axios.create().get).toHaveBeenCalledWith({
        method: 'get',
        url: 'http://api.github.com/user',
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
      axios.create().post.mockRejectedValue(networkError);

      const client = github('http://api.github.com');
      await expect(client.getToken('test_code')).rejects.toThrow('Network Error');
    });
  });
});
