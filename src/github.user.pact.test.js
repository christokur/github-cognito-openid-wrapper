const { PactV3 } = require('@pact-foundation/pact');
const github = require('./github');

describe('GitHub Client - User Operations', () => {
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
  });
});
