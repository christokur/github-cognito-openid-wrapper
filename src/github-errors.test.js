const qs = require('qs');
const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

jest.mock('./connectors/logger');
jest.mock('./utils/rate-limiter');

let github;
let logger;
let rateLimiter;
let githubErrors;

describe('GitHub Client - Error Handling', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    logger = require('./connectors/logger');
    rateLimiter = require('./utils/rate-limiter');
    github = require('./github');
    githubErrors = require('./github-errors');

    rateLimiter.updateLimits = jest.fn().mockResolvedValue();
    rateLimiter.isRateLimitError = jest.fn().mockReturnValue(false);
    rateLimiter.checkLimit = jest.fn().mockResolvedValue();
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./connectors/logger')];
    delete require.cache[require.resolve('./utils/rate-limiter')];
    delete require.cache[require.resolve('./github')];
    delete require.cache[require.resolve('./github-errors')];
  });

  describe('Network and Server Errors', () => {
    test('should handle empty responses', async () => {
      const config = {
        url: `${mockValues.GITHUB_API_URL}/user`,
        method: 'GET',
        headers: { Authorization: 'token test' },
        timeout: Number(mockValues.GITHUB_API_TIMEOUT),
      };

      mockAxios.get.mockResolvedValue(undefined);

      const client = github();
      await expect(client.getUserDetails('token')).rejects.toMatchObject({
        message: 'Invalid GitHub response: Empty response received',
        statusCode: 503,
        request: {
          url: config.url,
          method: 'GET',
          headers: expect.any(Object),
          timeout: expect.any(Number),
        },
      });
    });

    test('should handle network errors', async () => {
      const error = new Error('Network Error');
      error.code = 'ECONNREFUSED';
      error.config = {
        url: 'https://api.github.com/user',
        method: 'GET',
        headers: { Authorization: 'token test' },
        timeout: 5000,
      };

      mockAxios.get.mockRejectedValue(error);

      const client = github();
      await expect(client.getUserDetails('token')).rejects.toMatchObject({
        message: 'Network Error (ECONNREFUSED)',
        statusCode: 503,
        code: 'ECONNREFUSED',
        request: {
          url: error.config.url,
          method: 'GET',
          headers: expect.any(Object),
          timeout: expect.any(Number),
        },
      });
    });
  });

  describe('Rate Limit Handling', () => {
    test('should handle rate limit exceeded', async () => {
      const error = {
        response: {
          status: 429,
          headers: {
            'x-ratelimit-limit': '60',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1609459200',
          },
          data: { message: 'API rate limit exceeded' },
        },
        config: {
          url: `${mockValues.GITHUB_API_URL}/user`,
          method: 'GET',
          headers: { Authorization: 'token test' },
          timeout: Number(mockValues.GITHUB_API_TIMEOUT),
        },
      };

      rateLimiter.isRateLimitError.mockReturnValue(true);
      rateLimiter.checkLimit.mockImplementation(() => {
        const e = new Error('Rate limit exceeded');
        e.statusCode = 429;
        e.retryAfter = 3600;
        throw e;
      });
      mockAxios.get.mockRejectedValue(error);

      const client = github();
      await expect(client.getUserDetails('token')).rejects.toMatchObject({
        message: 'GitHub API responded with 429: API rate limit exceeded',
        statusCode: 429,
        request: {
          url: error.config.url,
          method: 'GET',
          headers: expect.any(Object),
          timeout: expect.any(Number),
        },
      });

      expect(rateLimiter.updateLimits).toHaveBeenCalledWith(
        error.response.headers,
      );
      expect(rateLimiter.checkLimit).toHaveBeenCalled();
    });

    test('should only update rate limits once per response', async () => {
      const response = {
        status: 200,
        headers: {
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '59',
          'x-ratelimit-reset': '1609459200',
        },
        data: { message: 'Success' },
      };

      // First call should update limits
      await githubErrors.handleGitHubResponse(response);
      expect(rateLimiter.updateLimits).toHaveBeenCalledTimes(1);
      expect(response.rateLimitsUpdated).toBe(true);

      // Second call should skip update
      await githubErrors.handleGitHubResponse(response);
      expect(rateLimiter.updateLimits).toHaveBeenCalledTimes(1);

      // Different response should update limits
      const newResponse = {
        ...response,
        headers: { ...response.headers },
      };
      delete newResponse.rateLimitsUpdated;
      await githubErrors.handleGitHubResponse(newResponse);
      expect(rateLimiter.updateLimits).toHaveBeenCalledTimes(2);
      expect(newResponse.rateLimitsUpdated).toBe(true);
    });
  });

  describe('OAuth Errors', () => {
    test('should handle OAuth error response', async () => {
      const response = {
        status: 200,
        data: {
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired',
          error_uri: 'https://docs.github.com/apps/oauth',
        },
      };

      mockAxios.post.mockResolvedValue(response);

      const client = github();
      await expect(client.getToken('code')).rejects.toMatchObject({
        message:
          'Bad Request - bad_verification_code: The code passed is incorrect or expired',
        statusCode: 400,
        docs: 'https://docs.github.com/apps/oauth',
        response: expect.any(Object),
        request: expect.any(Object),
      });
    });
  });

  describe('API Errors', () => {
    test('should handle API error response', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            message: 'Bad credentials',
            documentation_url: 'https://docs.github.com/rest',
          },
        },
        config: {
          url: 'https://api.github.com/user',
          method: 'GET',
          headers: { Authorization: 'token test' },
        },
      };

      mockAxios.get.mockRejectedValue(error);

      const client = github();
      await expect(client.getUserDetails('token')).rejects.toMatchObject({
        message: 'GitHub API responded with 401: Bad credentials',
        statusCode: 401,
        docs: 'https://docs.github.com/rest',
        response: expect.any(Object),
        request: {
          url: error.config.url,
          method: 'GET',
          headers: expect.any(Object),
        },
      });
    });
  });
});

afterAll(() => {
  jest.useRealTimers();
});
