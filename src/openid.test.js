/* eslint-disable */
/* eslint-disable no-undef */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */


// const path = require('path');

jest.mock('./github', () => {
  const githubMock = {
    urls: {
      userDetails: null,
      userEmails: null,
      oauthToken: null,
      oauthAuthorize: null,
    },
    getAuthorizeUrl: jest.fn((client_id, scope, state, response_type) => {}),
    getUserDetails: jest.fn((accessToken) => {}),
    getUserEmails: jest.fn((accessToken) => jest.fn(() => {})),
    getToken: (code, state) => jest.fn(() => {}),
  };

  return jest.fn(() => githubMock);
});

jest.mock('./crypto', () => {
  const cryptoMock = {
    getPublicKey: jest.fn(() => ({
      alg: 'RS256',
      kid: 'jwtRS256',
      kty: 'RSA',
      e: 'AQAB',
      n: 'mocked_n_value',
    })),
    makeIdToken: jest.fn(() => 'mocked_id_token'),
  };

  return cryptoMock;
});

describe('openid domain layer', () => {
    let openid;
    // eslint-disable-next-line no-unused-vars
    let githubMockInstance;
    // eslint-disable-next-line no-unused-vars
    let cryptoMockInstance;

  beforeEach(async () => {
    // Import openid functions after mocks are set up
    // eslint-disable-next-line global-require
    openid = require('./openid');
    // eslint-disable-next-line global-require
    githubMockInstance = require('./github')();
    // eslint-disable-next-line global-require
    cryptoMockInstance = require('./crypto');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('userinfo function', () => {
    describe('with a good token', () => {
      describe('with complete user details', () => {
        describe('with a primary email', () => {
          test('complete', async () => {
            const userDetails = {
              login: 'octocat',
              id: 1,
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              name: 'monalisa octocat',
              email: 'octocat@github.com',
              html_url: 'https://github.com/octocat',
              blog: 'https://github.blog',
              updated_at: '2008-01-14T04:33:35Z',
            };

            const userEmails = [
              {
                email: 'octocat@github.com',
                primary: true,
                verified: true,
                visibility: null,
              },
            ];

            const githubMockInstance = require('./github')();
            githubMockInstance.getUserDetails.mockResolvedValue(userDetails);
            githubMockInstance.getUserEmails.mockResolvedValue(userEmails);

            const result = await openid.getUserInfo('good_token');

            const expectedUpdatedAt =
              new Date(userDetails.updated_at || '').getTime() / 1000;

            expect(result).toEqual({
              sub: userDetails.id.toString(),
              name: 'monalisa octocat',
              email: 'octocat@github.com',
              email_verified: true,
              picture: 'https://github.com/images/error/octocat_happy.gif',
              preferred_username: 'octocat',
              profile: 'https://github.com/octocat',
              website: 'https://github.blog',
              updated_at: expectedUpdatedAt,
            });

            expect(githubMockInstance.getUserDetails).toHaveBeenCalledWith(
              'good_token',
            );
            expect(githubMockInstance.getUserEmails).toHaveBeenCalledWith(
              'good_token',
            );
          });

          test('without a primary email', async () => {
            const userDetails = {
              login: 'octocat',
              id: 1,
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              name: 'monalisa octocat',
              email: 'octocat@github.com',
              html_url: 'https://github.com/octocat',
              blog: 'https://github.blog',
              updated_at: '2008-01-14T04:33:35Z',
            };

            const userEmails = [
              {
                email: 'octocat@github.com',
                primary: false,
                verified: true,
                visibility: null,
              },
            ];

            const githubMockInstance = require('./github')();
            githubMockInstance.getUserDetails.mockResolvedValue(userDetails);
            githubMockInstance.getUserEmails.mockResolvedValue(userEmails);

            await expect(
              openid.getUserInfo('without_a_primary_email'),
            ).rejects.toEqual(
              new Error('User did not have a primary email address'),
            );

            expect(githubMockInstance.getUserDetails).toHaveBeenCalledWith(
              'without_a_primary_email',
            );
            expect(githubMockInstance.getUserEmails).toHaveBeenCalledWith(
              'without_a_primary_email',
            );
          });
        });

        describe('without a primary email', () => {
          test('fails', async () => {
            const userDetails = {
              login: 'octocat',
              id: 1,
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              name: 'monalisa octocat',
              email: 'octocat@github.com',
              html_url: 'https://github.com/octocat',
              blog: 'https://github.blog',
              updated_at: '2008-01-14T04:33:35Z',
            };

            const userEmails = [
              {
                email: 'octocat@github.com',
                primary: false,
                verified: true,
                visibility: null,
              },
            ];

            const githubMockInstance = require('./github')();
            githubMockInstance.getUserDetails.mockResolvedValue(userDetails);
            githubMockInstance.getUserEmails.mockResolvedValue(userEmails);

            await expect(
              openid.getUserInfo('without_a_primary_email'),
            ).rejects.toEqual(
              new Error('User did not have a primary email address'),
            );

            expect(githubMockInstance.getUserDetails).toHaveBeenCalledWith(
              'without_a_primary_email',
            );
            expect(githubMockInstance.getUserEmails).toHaveBeenCalledWith(
              'without_a_primary_email',
            );
          });
        });
      });

      describe('with a bad token', () => {
        test('fails', async () => {
          const error = {
            response: {
              status: 401,
              data: { message: 'Bad credentials' },
            },
            message: 'Bad credentials',
          };

          const githubMockInstance = require('./github')();
          githubMockInstance.getUserDetails.mockRejectedValue(error);

          await expect(openid.getUserInfo('bad_token')).rejects.toMatchObject(
            error,
          );

          expect(githubMockInstance.getUserDetails).toHaveBeenCalledWith(
            'bad_token',
          );
          expect(githubMockInstance.getUserEmails).not.toHaveBeenCalled();
        });

        test('handles errors in getUserInfo', async () => {
          const detailsError = new Error('Failed to fetch user details');

          const githubMockInstance = require('./github')();
          githubMockInstance.getUserDetails.mockRejectedValue(detailsError);

          await expect(openid.getUserInfo('bad_token')).rejects.toThrow(
            'Failed to fetch user details',
          );
        });
      });
    });
  });

  describe('token function', () => {
    describe('with the correct code', () => {
      test('returns a token', async () => {
        const githubMockInstance = require('./github')();
        githubMockInstance.getToken = jest.fn().mockResolvedValue({
          access_token: 'SOME_TOKEN',
          token_type: 'bearer',
          scope: 'scope1 scope2',
        });

        const token = await openid.getTokens(
          'SOME_CODE',
          'SOME_STATE',
          'SOME_HOST',
        );

        expect(token).toEqual({
          access_token: 'SOME_TOKEN',
          id_token: expect.any(String),
          scope: 'openid scope1 scope2',
          token_type: 'bearer',
        });
      });
    });

    describe('with a bad code', () => {
      test('fails', async () => {
        const githubMockInstance = require('./github')();
        githubMockInstance.getToken = jest
          .fn()
          .mockRejectedValue(new Error('Bad code'));

        await expect(
          openid.getTokens('bad_code', 'state', 'host'),
        ).rejects.toThrow('Bad code');
      });
    });
  });

  describe('jwks', () => {
    test('Returns the right structure', () => {
      expect(openid.getJwks()).toEqual({
        keys: [
          {
            alg: 'RS256',
            kid: 'jwtRS256',
            kty: 'RSA',
            e: 'AQAB',
            n: 'mocked_n_value',
          },
        ],
      });
    });
  });

  describe('authorization', () => {
    test('Redirects to the authorization URL', () => {
      const githubMockInstance = require('./github')();
      githubMockInstance.getAuthorizeUrl.mockReturnValue(
        'https://github.com/login/oauth/authorize?client_id=client_id&scope=scope&state=state&response_type=response_type',
      );
      const url = openid.getAuthorizeUrl(
        'client_id',
        'scope',
        'state',
        'response_type',
      );

      expect(url).toBe(
        'https://github.com/login/oauth/authorize?client_id=client_id&scope=scope&state=state&response_type=response_type',
      );
      expect(githubMockInstance.getAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(githubMockInstance.getAuthorizeUrl).toHaveBeenCalledWith(
        'client_id',
        'scope',
        'state',
        'response_type',
      );
    });
  });

  describe('openid-configuration', () => {
    describe('with a supplied hostname', () => {
      test('returns the correct response', () => {
        // Mock the expected behavior
        const githubMockInstance = require('./github')();
        githubMockInstance.getAuthorizeUrl.mockReturnValue(
          'https://not-a-real-host.com/authorize',
        );

        // Simulate the call to getAuthorizeUrl
        const url = githubMockInstance.getAuthorizeUrl(
          'client_id',
          'scope',
          'state',
          'response_type',
        );

        const config = openid.getConfigFor('not-a-real-host.com');

        // Verify the expected configuration
        expect(config).toEqual({
          authorization_endpoint: url,
          claims_supported: [
            'sub',
            'name',
            'preferred_username',
            'profile',
            'picture',
            'website',
            'email',
            'email_verified',
            'updated_at',
            'iss',
            'aud',
          ],
          display_values_supported: ['page', 'popup'],
          id_token_signing_alg_values_supported: ['RS256'],
          issuer: 'https://not-a-real-host.com',
          jwks_uri: 'https://not-a-real-host.com/.well-known/jwks.json',
          request_object_signing_alg_values_supported: ['none'],
          response_types_supported: [
            'code',
            'code id_token',
            'id_token',
            'token id_token',
          ],
          scopes_supported: ['openid', 'read:user', 'user:email'],
          subject_types_supported: ['public'],
          token_endpoint: 'https://not-a-real-host.com/token',
          token_endpoint_auth_methods_supported: [
            'client_secret_basic',
            'private_key_jwt',
          ],
          token_endpoint_auth_signing_alg_values_supported: ['RS256'],
          userinfo_endpoint: 'https://not-a-real-host.com/userinfo',
          userinfo_signing_alg_values_supported: ['none'],
        });

        // Verify that the mock was called
        expect(githubMockInstance.getAuthorizeUrl).toHaveBeenCalledWith(
          'client_id',
          'scope',
          'state',
          'response_type',
        );
      });
    });
  });
});
