const { mockAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

describe('openid domain layer - User Info', () => {
  let openid;
  let github;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    openid = require('./openid');
    github = require('./github');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./openid')];
    delete require.cache[require.resolve('./github')];
  });

  // User Info Tests
  describe('userinfo function', () => {
    describe('with a good token', () => {
      describe('with complete user details', () => {
        describe('with a primary email', () => {
          test('complete', async () => {
            const userResponse = {
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
              },
            };

            const emailsResponse = {
              status: 200,
              headers: {},
              data: [
                {
                  email: mockValues.USER_EMAIL,
                  primary: true,
                  verified: true,
                  visibility: null,
                },
              ],
            };

            // Mock all potential retries for user details
            mockAxios.get
              .mockResolvedValueOnce(userResponse)
              .mockResolvedValueOnce(emailsResponse);

            const result = await openid.getUserInfo('good_token');

            const expectedUpdatedAt =
              new Date(mockValues.USER_UPDATED_AT).getTime() / 1000;

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
                timeout: 10000,
              },
            );

            expect(mockAxios.get).toHaveBeenCalledWith(
              `${mockValues.GITHUB_API_URL}/user/emails`,
              {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: 'token good_token',
                },
                timeout: 10000,
              },
            );
          });
        });

        describe('without a primary email', () => {
          test('fails', async () => {
            const userResponse = {
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
              },
            };

            const emailsResponse = {
              status: 200,
              headers: {},
              data: [], // No emails at all
            };

            mockAxios.get
              .mockResolvedValueOnce(userResponse)
              .mockResolvedValueOnce(emailsResponse);

            await expect(
              openid.getUserInfo('without_a_primary_email'),
            ).rejects.toThrow('User did not have a primary email address');

            expect(mockAxios.get).toHaveBeenCalledWith(
              `${mockValues.GITHUB_API_URL}/user`,
              {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: 'token without_a_primary_email',
                },
                timeout: 10000,
              },
            );

            expect(mockAxios.get).toHaveBeenCalledWith(
              `${mockValues.GITHUB_API_URL}/user/emails`,
              {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: 'token without_a_primary_email',
                },
                timeout: 10000,
              },
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

          mockAxios.get.mockRejectedValue(error);

          await expect(openid.getUserInfo('bad_token')).rejects.toThrow(
            'Bad credentials',
          );

          expect(mockAxios.get).toHaveBeenCalledWith(
            `${mockValues.GITHUB_API_URL}/user`,
            {
              headers: {
                Accept: 'application/vnd.github.v3+json',
                Authorization: 'token bad_token',
              },
              timeout: 10000,
            },
          );
        });

        test('handles errors in getUserInfo', async () => {
          const detailsError = {
            response: {
              status: 500,
              data: { message: 'Failed to fetch user details' },
            },
          };

          mockAxios.get.mockRejectedValue(detailsError);

          await expect(openid.getUserInfo('bad_token')).rejects.toThrow(
            'Failed to fetch user details',
          );
        });
      });
    });
  });
});
