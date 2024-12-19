const { mockValues } = require('./mocks');
require('./mocks');

describe('openid domain layer - User Info', () => {
  let openid;
  let github;
  let client;
  let mockAxios;

  // Store original env
  const originalEnv = { ...process.env };

  beforeAll(() => {
    // Set environment variables before requiring modules
    process.env.GITHUB_CLIENT_ID = mockValues.GITHUB_CLIENT_ID;
    process.env.GITHUB_CLIENT_SECRET = mockValues.GITHUB_CLIENT_SECRET;
    process.env.COGNITO_REDIRECT_URI = mockValues.COGNITO_REDIRECT_URI;
    process.env.GITHUB_API_URL = mockValues.GITHUB_API_URL;
    process.env.GITHUB_LOGIN_URL = mockValues.GITHUB_LOGIN_URL;
  });

  beforeEach(() => {
    jest.resetModules();
    const { mockAxios: axiosMock } = require('./sharedMocks');
    mockAxios = axiosMock;
    openid = require('./openid');
    github = require('./github');
    client = github();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
    jest.resetAllMocks();
  });

  // User Info Tests
  describe('userinfo function', () => {
    describe('with a good token', () => {
      describe('with complete user details', () => {
        describe('with a primary email', () => {
          test('complete', async () => {
            const { mockAxios } = require('./sharedMocks');
            mockAxios.get.mockImplementation((url) => {
              if (url === `${mockValues.GITHUB_API_URL}/user`) {
                return Promise.resolve({
                  status: 200,
                  headers: {},
                  data: {
                    login: mockValues.USER_LOGIN,
                    id: mockValues.USER_ID,
                    avatar_url: `${mockValues.GITHUB_API_URL}/images/error/${mockValues.USER_AVATAR}`,
                    name: mockValues.USER_NAME,
                    email: mockValues.USER_EMAIL,
                    html_url: `${mockValues.GITHUB_LOGIN_URL}/${mockValues.USER_LOGIN}`,
                    blog: `${mockValues.GITHUB_LOGIN_URL}/${mockValues.USER_BLOG}`,
                    updated_at: mockValues.USER_UPDATED_AT,
                  }
                });
              } else if (url === `${mockValues.GITHUB_API_URL}/user/emails`) {
                return Promise.resolve({
                  status: 200,
                  headers: {},
                  data: [
                    {
                      email: mockValues.USER_EMAIL,
                      primary: true,
                      verified: true,
                      visibility: null,
                    }
                  ]
                });
              }
              throw new Error(`Unexpected URL: ${url}`);
            });

            const result = await openid.getUserInfo('good_token');

            const expectedUpdatedAt = new Date(mockValues.USER_UPDATED_AT).getTime() / 1000;

            expect(result).toEqual({
              sub: mockValues.USER_ID.toString(),
              name: mockValues.USER_NAME,
              email: mockValues.USER_EMAIL,
              email_verified: true,
              picture: `${mockValues.GITHUB_API_URL}/images/error/${mockValues.USER_AVATAR}`,
              preferred_username: mockValues.USER_LOGIN,
              profile: `${mockValues.GITHUB_LOGIN_URL}/${mockValues.USER_LOGIN}`,
              website: `${mockValues.GITHUB_LOGIN_URL}/${mockValues.USER_BLOG}`,
              updated_at: expectedUpdatedAt,
            });

            expect(mockAxios.get).toHaveBeenCalledWith(
              `${mockValues.GITHUB_API_URL}/user`,
              {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: 'token good_token',
                },
                timeout: 10000
              }
            );

            expect(mockAxios.get).toHaveBeenCalledWith(
              `${mockValues.GITHUB_API_URL}/user/emails`,
              {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: 'token good_token',
                },
                timeout: 10000
              }
            );
          });
        });

        describe('without a primary email', () => {
          test('fails', async () => {
            const { mockAxios } = require('./sharedMocks');
            mockAxios.get.mockImplementation((url) => {
              if (url === `${mockValues.GITHUB_API_URL}/user`) {
                return Promise.resolve({
                  status: 200,
                  headers: {},
                  data: {
                    login: mockValues.USER_LOGIN,
                    id: mockValues.USER_ID,
                    avatar_url: `${mockValues.GITHUB_API_URL}/images/error/${mockValues.USER_AVATAR}`,
                    name: mockValues.USER_NAME,
                    email: mockValues.USER_EMAIL,
                    html_url: `${mockValues.GITHUB_LOGIN_URL}/${mockValues.USER_LOGIN}`,
                    blog: `${mockValues.GITHUB_LOGIN_URL}/${mockValues.USER_BLOG}`,
                    updated_at: mockValues.USER_UPDATED_AT,
                  }
                });
              } else if (url === `${mockValues.GITHUB_API_URL}/user/emails`) {
                return Promise.resolve({
                  status: 200,
                  headers: {},
                  data: [
                    {
                      email: mockValues.USER_EMAIL,
                      primary: false,
                      verified: true,
                      visibility: null,
                    }
                  ]
                });
              }
              throw new Error(`Unexpected URL: ${url}`);
            });

            await expect(
              openid.getUserInfo('without_a_primary_email')
            ).rejects.toThrow('User did not have a primary email address');

            expect(mockAxios.get).toHaveBeenCalledWith(
              `${mockValues.GITHUB_API_URL}/user`,
              {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: 'token without_a_primary_email',
                },
                timeout: 10000
              }
            );

            expect(mockAxios.get).toHaveBeenCalledWith(
              `${mockValues.GITHUB_API_URL}/user/emails`,
              {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: 'token without_a_primary_email',
                },
                timeout: 10000
              }
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
          };

          const { mockAxios } = require('./sharedMocks');
          mockAxios.get.mockRejectedValue(error);

          await expect(openid.getUserInfo('bad_token')).rejects.toThrow('Bad credentials');

          expect(mockAxios.get).toHaveBeenCalledWith(
            `${mockValues.GITHUB_API_URL}/user`,
            {
              headers: {
                Accept: 'application/vnd.github.v3+json',
                Authorization: 'token bad_token',
              },
              timeout: 10000
            }
          );
        });

        test('handles errors in getUserInfo', async () => {
          const detailsError = {
            response: {
              status: 500,
              data: { message: 'Failed to fetch user details' },
            },
          };

          const { mockAxios } = require('./sharedMocks');
          mockAxios.get.mockRejectedValue(detailsError);

          await expect(openid.getUserInfo('bad_token')).rejects.toThrow(
            'Failed to fetch user details'
          );
        });
      });
    });
  });
});
