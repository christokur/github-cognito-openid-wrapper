const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const github = require('./github');
const qs = require('qs');

describe('GitHub Client - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const provider = new PactV3({
    dir: './pacts',
    consumer: 'github-cognito-openid-wrapper',
    provider: 'github',
    logLevel: 'debug',
  });

  // Store original env
  const originalEnv = { ...process.env };

  // Set up environment variables for tests
  beforeAll(() => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
    process.env.COGNITO_REDIRECT_URI = 'http://localhost/callback';
    process.env.GITHUB_LOGIN_URL = 'http://localhost';
    process.env.GITHUB_API_URL = 'http://localhost';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Network and Server Errors', () => {
    test('should handle network errors', async () => {
      await provider
        .given('a network error occurs')
        .uponReceiving('a request that fails with network error')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token network_error_token',
          },
        })
        .willRespondWith({
          status: 503,
          statusText: 'Service Unavailable',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'Service Unavailable',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Use mock server URL for both API and OAuth endpoints
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('network_error_token')).rejects.toThrow(
          'GitHub API responded with a failure: 503 (Service Unavailable)'
        );
      });
    });

    test('should handle non-200 status without error object', async () => {
      await provider
        .given('a server error occurs')
        .uponReceiving('a request that returns 500')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token server_error_token',
          },
        })
        .willRespondWith({
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'Internal Server Error',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Use mock server URL for both API and OAuth endpoints
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('server_error_token')).rejects.toThrow(
          'GitHub API responded with a failure: 500 (Internal Server Error)'
        );
      });
    });

    test('should handle 401 Unauthorized', async () => {
      await provider
        .given('an unauthorized request')
        .uponReceiving('a request with unauthorized token')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token unauthorized_token',
          },
        })
        .willRespondWith({
          status: 401,
          statusText: 'Unauthorized',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'Bad credentials',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Use mock server URL for both API and OAuth endpoints
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('unauthorized_token')).rejects.toThrow(
          'GitHub API responded with a failure: 401 (Bad credentials)'
        );
      });
    });
  });

  describe('API Errors', () => {
    test('should handle error response with 200 status', async () => {
      await provider
        .given('an API error with 200 status')
        .uponReceiving('a request that returns an error with 200 status')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token api_error_token',
          },
        })
        .willRespondWith({
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'An API error occurred',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Use mock server URL for both API and OAuth endpoints
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('api_error_token')).rejects.toThrow(
          'An API error occurred'
        );
      });
    });

    test('should handle OAuth error response', async () => {
      await provider
        .given('an OAuth error')
        .uponReceiving('a request with invalid code')
        .withRequest({
          method: 'POST',
          path: '/login/oauth/access_token',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: qs.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: 'invalid_code',
            redirect_uri: process.env.COGNITO_REDIRECT_URI
          }),
        })
        .willRespondWith({
          status: 400,
          statusText: 'Bad Request',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
            error_uri: 'https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps'
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and login endpoints
        process.env.GITHUB_API_URL = mockServer.url;
        process.env.GITHUB_LOGIN_URL = mockServer.url;
        
        // Create a new github client module instance to pick up the new environment variables
        jest.resetModules();
        const github = require('./github');
        
        // Create a new client instance
        const client = github();
        await expect(
          client.getToken('invalid_code')
        ).rejects.toThrow(
          'GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)'
        );
      });
    });
  });
});
