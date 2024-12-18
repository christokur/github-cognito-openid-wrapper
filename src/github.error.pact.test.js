const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const github = require('./github');
const qs = require('qs');

describe('GitHub Client - Error Handling', () => {
  let provider;
  let mockServer;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a new PactV3 instance for each test
    provider = new PactV3({
      dir: './pacts',
      consumer: 'github-cognito-openid-wrapper',
      provider: 'github',
      logLevel: 'debug',
    });
  });

  afterEach(async () => {
    // Clean up mock server after each test
    if (mockServer) {
      await mockServer.close();
    }
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
        .given('A network error occurs')
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'Service Unavailable',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and OAuth endpoints
        process.env.GITHUB_API_URL = mockServer.url;
        process.env.GITHUB_LOGIN_URL = mockServer.url;
        
        // Create a new github client module instance to pick up the new environment variables
        jest.resetModules();
        const github = require('./github');
        
        // Create a new client instance
        const client = github();
        await expect(client.getUserDetails('network_error_token')).rejects.toThrow(
          'GitHub API responded with a failure: 503 (Service Unavailable)'
        );
      });
    }, 30000);

    test('should handle non-200 status without error object', async () => {
      await provider
        .given('A server error occurs')
        .uponReceiving('a request that fails with server error')
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'Internal Server Error',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and OAuth endpoints
        process.env.GITHUB_API_URL = mockServer.url;
        process.env.GITHUB_LOGIN_URL = mockServer.url;
        
        // Create a new github client module instance to pick up the new environment variables
        jest.resetModules();
        const github = require('./github');
        
        // Create a new client instance
        const client = github();
        await expect(client.getUserDetails('server_error_token')).rejects.toThrow(
          'GitHub API responded with a failure: 500 (Internal Server Error)'
        );
      });
    }, 30000);

    test('should handle 401 Unauthorized', async () => {
      await provider
        .given('An unauthorized error occurs')
        .uponReceiving('a request that fails with unauthorized error')
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'Bad credentials',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and OAuth endpoints
        process.env.GITHUB_API_URL = mockServer.url;
        process.env.GITHUB_LOGIN_URL = mockServer.url;
        
        // Create a new github client module instance to pick up the new environment variables
        jest.resetModules();
        const github = require('./github');
        
        // Create a new client instance
        const client = github();
        await expect(client.getUserDetails('unauthorized_token')).rejects.toThrow(
          'GitHub API responded with a failure: 401 (Bad credentials)'
        );
      });
    });
  });

  describe('API Errors', () => {
    test('should handle error response with 200 status', async () => {
      await provider
        .given('An API error occurs')
        .uponReceiving('a request that returns an error message')
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'An API error occurred',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and OAuth endpoints
        process.env.GITHUB_API_URL = mockServer.url;
        process.env.GITHUB_LOGIN_URL = mockServer.url;
        
        // Create a new github client module instance to pick up the new environment variables
        jest.resetModules();
        const github = require('./github');
        
        // Create a new client instance
        const client = github();
        await expect(client.getUserDetails('api_error_token')).rejects.toThrow(
          'An API error occurred'
        );
      });
    });

    test('should handle OAuth error response', async () => {
      await provider
        .given('OAuth error occurs')
        .uponReceiving('a request that returns an OAuth error')
        .withRequest({
          method: 'POST',
          path: '/login/oauth/access_token',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&code=invalid_code&redirect_uri=${encodeURIComponent(process.env.COGNITO_REDIRECT_URI)}`,
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
            error_uri: 'https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and OAuth endpoints
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
          'GitHub API responded with a failure: 200 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)'
        );
      });
    });

    test('should handle successful user emails request', async () => {
      await provider
        .given('A successful user emails request')
        .uponReceiving('a request for user emails')
        .withRequest({
          method: 'GET',
          path: '/user/emails',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token good_token',
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: [
            {
              email: 'octocat@github.com',
              verified: true,
              primary: true,
              visibility: 'public',
            },
          ],
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and OAuth endpoints
        process.env.GITHUB_API_URL = mockServer.url;
        process.env.GITHUB_LOGIN_URL = mockServer.url;
        
        // Create a new github client module instance to pick up the new environment variables
        jest.resetModules();
        const github = require('./github');
        
        // Create a new client instance
        const client = github();
        const emails = await client.getUserEmails('good_token');
        expect(emails).toEqual([
          {
            email: 'octocat@github.com',
            verified: true,
            primary: true,
            visibility: 'public',
          },
        ]);
      });
    });

    test('should handle unauthorized request for user emails with bad credentials', async () => {
      await provider
        .given('An unauthorized request for user emails')
        .uponReceiving('a request for user emails with bad credentials')
        .withRequest({
          method: 'GET',
          path: '/user/emails',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token bad_token',
          },
        })
        .willRespondWith({
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: 'Bad credentials',
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Set the mock server URL for both API and OAuth endpoints
        process.env.GITHUB_API_URL = mockServer.url;
        process.env.GITHUB_LOGIN_URL = mockServer.url;
        
        // Create a new github client module instance to pick up the new environment variables
        jest.resetModules();
        const github = require('./github');
        
        // Create a new client instance
        const client = github();
        await expect(client.getUserEmails('bad_token')).rejects.toThrow(
          'GitHub API responded with a failure: 401 (Bad credentials)'
        );
      });
    });
  });
});
