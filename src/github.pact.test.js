const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const github = require('./github');
const axios = require('axios');

describe('GitHub Client', () => {
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
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getUserDetails', () => {
    test('with valid token', async () => {
      await provider
        .given('a valid access token exists')
        .uponReceiving('a request for user details')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token good_token',
          },
        })
        .willRespondWith({
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            login: 'octocat',
            name: 'monalisa octocat',
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url, mockServer.url);
        const response = await client.getUserDetails('good_token');
        expect(response).toEqual({
          login: 'octocat',
          name: 'monalisa octocat',
        });
      });
    });

    test('with bad token', async () => {
      await provider
        .given('an invalid access token')
        .uponReceiving('a request with invalid token')
        .withRequest({
          method: 'GET',
          path: '/user',
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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('bad_token')).rejects.toThrow(
          'Request failed with status code 401',
        );
      });
    });

    test('with api error', async () => {
      await provider
        .given('an API error occurs')
        .uponReceiving('a request that returns an API error')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token error_token',
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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('error_token')).rejects.toThrow(
          'GitHub API responded with a failure: An API error occurred',
        );
      });
    });
  });

  describe('getUserEmails', () => {
    test('with valid token', async () => {
      await provider
        .given('a valid access token exists')
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
          statusText: 'OK',
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
        const client = github(mockServer.url, mockServer.url);
        const response = await client.getUserEmails('good_token');
        expect(response).toEqual([
          {
            email: 'octocat@github.com',
            primary: true,
            verified: true,
            visibility: 'public',
          },
        ]);
      });
    });

    test('with bad token', async () => {
      await provider
        .given('an invalid access token')
        .uponReceiving('a request with invalid token')
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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserEmails('bad_token')).rejects.toThrow(
          'Request failed with status code 401',
        );
      });
    });

    test('with api error', async () => {
      await provider
        .given('an API error occurs')
        .uponReceiving('a request that returns an API error')
        .withRequest({
          method: 'GET',
          path: '/user/emails',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'token error_token',
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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserEmails('error_token')).rejects.toThrow(
          'GitHub API responded with a failure: An API error occurred',
        );
      });
    });
  });

  describe('getToken', () => {
    const VALID_CODE = 'valid_code';
    const INVALID_CODE = 'invalid_code';

    test('with valid code', async () => {
      await provider
        .given('a valid authorization code')
        .uponReceiving('a token request with valid code')
        .withRequest({
          method: 'POST',
          path: '/login/oauth/access_token',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: MatchersV3.like({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            redirect_uri: process.env.COGNITO_REDIRECT_URI,
            code: VALID_CODE,
            grant_type: 'authorization_code',
            response_type: 'code',
          }),
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            access_token: 'test_access_token',
            token_type: 'bearer',
            scope: 'user:email',
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url, mockServer.url);
        const response = await client.getToken(VALID_CODE);
        expect(response.access_token).toBe('test_access_token');
        expect(response.token_type).toBe('bearer');
        expect(response.scope).toBe('user:email');
      });
    });

    test('with invalid code', async () => {
      await provider
        .given('an invalid authorization code')
        .uponReceiving('a token request with invalid code')
        .withRequest({
          method: 'POST',
          path: '/login/oauth/access_token',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: MatchersV3.like({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            redirect_uri: process.env.COGNITO_REDIRECT_URI,
            code: INVALID_CODE,
            grant_type: 'authorization_code',
            response_type: 'code',
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
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getToken(INVALID_CODE)).rejects.toThrow(
          'GitHub API responded with a failure: 400 (Bad Request)',
        );
      });
    });
  });

  describe('getAuthorizeUrl', () => {
    test('returns a redirect url', async () => {
      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url, mockServer.url);
        const url = client.getAuthorizeUrl(
          'client_id',
          'scope',
          'state',
          'response_type',
        );
        expect(url).toBe(
          `${mockServer.url}/login/oauth/authorize?client_id=client_id&scope=scope&state=state&response_type=response_type`,
        );
      });
    });
  });

  describe('error handling', () => {
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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('network_error_token')).rejects.toThrow(
          'Request failed with status code 503',
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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('server_error_token')).rejects.toThrow(
          'Request failed with status code 500',
        );
      });
    });

    test('should handle OAuth error response', async () => {
      await provider
        .given('an OAuth error occurs')
        .uponReceiving('a token request that returns an OAuth error')
        .withRequest({
          method: 'POST',
          path: '/login/oauth/access_token',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: MatchersV3.like({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            redirect_uri: process.env.COGNITO_REDIRECT_URI,
            code: 'oauth_error_code',
            grant_type: 'authorization_code',
            response_type: 'code',
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
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getToken('oauth_error_code')).rejects.toThrow(
          'GitHub API responded with a failure: 400 (Bad Request)',
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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('unauthorized_token')).rejects.toThrow(
          'Request failed with status code 401',
        );
      });
    });

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
        const client = github(mockServer.url, mockServer.url);
        await expect(client.getUserDetails('api_error_token')).rejects.toThrow(
          'GitHub API responded with a failure: An API error occurred',
        );
      });
    });
  });
});
