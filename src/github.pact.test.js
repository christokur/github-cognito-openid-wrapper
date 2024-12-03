const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const github = require('./github');

describe('GitHub Client', () => {
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
    const VALID_TOKEN = 'good_token';
    const INVALID_TOKEN = 'bad_token';

    test('with valid token', async () => {
      await provider
        .given('a valid access token exists')
        .uponReceiving('a request for user details')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${VALID_TOKEN}`,
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: MatchersV3.like({
            name: 'monalisa octocat',
            login: 'octocat',
          }),
        });

      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url);
        const response = await client.getUserDetails(VALID_TOKEN);
        expect(response.name).toBe('monalisa octocat');
        expect(response.login).toBe('octocat');
      });
    });

    test('with invalid token', async () => {
      await provider
        .given('an invalid access token')
        .uponReceiving('a request with invalid token')
        .withRequest({
          method: 'GET',
          path: '/user',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${INVALID_TOKEN}`,
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
        const client = github(mockServer.url);
        await expect(client.getUserDetails(INVALID_TOKEN)).rejects.toThrow(
          'Request failed with status code 401',
        );
      });
    });
  });

  describe('getUserEmails', () => {
    const VALID_TOKEN = 'good_token';

    test('with valid token', async () => {
      await provider
        .given('a valid access token exists')
        .uponReceiving('a request for user emails')
        .withRequest({
          method: 'GET',
          path: '/user/emails',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${VALID_TOKEN}`,
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: MatchersV3.eachLike({
            email: 'octocat@github.com',
            verified: true,
            primary: true,
          }),
        });

      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url);
        const response = await client.getUserEmails(VALID_TOKEN);
        expect(response[0].email).toBe('octocat@github.com');
        expect(response[0].verified).toBe(true);
        expect(response[0].primary).toBe(true);
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
            code: INVALID_CODE,
            grant_type: 'authorization_code',
            response_type: 'code',
          }),
        })
        .willRespondWith({
          status: 400,
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
          'Request failed with status code 400',
        );
      });
    });
  });

  describe('getAuthorizeUrl', () => {
    test('returns a redirect url', async () => {
      await provider.executeTest(async (mockServer) => {
        const client = github(mockServer.url);
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
});
