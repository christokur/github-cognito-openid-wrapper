const qs = require('qs'); // Add this line to import the qs library
const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

let github;

describe('GitHub Client - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    github = require('./github');
  });

  describe('Network and Server Errors', () => {
    test('should handle empty responses', () => {
      // Mock the axios response to be null
      mockAxios.get.mockResolvedValue(undefined);

      const client = github();
      return client.getUserDetails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('Network error occurred while contacting GitHub API');
          expect(err.statusCode).toBe(503);
          expect(err.type).toBe('network_error');
        });
    });

    test('should handle network errors', () => {
      const networkError = new Error('Network Error');
      // Simulate a network error by ensuring response is undefined
      networkError.response = undefined;
      mockAxios.get.mockRejectedValue(networkError);

      const client = github();
      return client.getUserDetails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('Network error occurred while contacting GitHub API');
          expect(err.statusCode).toBe(503);
          expect(err.type).toBe('network_error');
        });
    });

    test('should handle non-200 status without error object', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal Server Error' }
        }
      });

      const client = github();
      return client.getUserDetails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 500 (Internal Server Error)');
          expect(err.statusCode).toBe(500);
          expect(err.type).toBe('github_error');
        });
    });

    test('should handle 401 Unauthorized', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Bad credentials' }
        }
      });

      const client = github();
      return client.getUserDetails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 401 (Bad credentials)');
          expect(err.statusCode).toBe(401);
          expect(err.type).toBe('github_error');
        });
    });

    test('should handle error message in response data', () => {
      // This will trigger lines 28-30 in github-errors.js
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: { message: 'API Error Message' }
      });

      const client = github();
      return client.getUserDetails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 200 (API Error Message)');
          expect(err.type).toBe('github_error');
        });
    });

    test('should handle OAuth error in response data', () => {
      // This will trigger lines 35-37 in github-errors.js
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: { 
          error: 'invalid_request', 
          error_description: 'OAuth Error' 
        }
      });

      const client = github();
      return client.getToken('test_code')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 200 (Bad Request - invalid_request: OAuth Error)');
          expect(err.type).toBe('github_error');
        });
    });

    test('should handle API error response', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 200,
          data: {
            message: 'An API error occurred'
          }
        }
      });

      const client = github();
      return client.getUserDetails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 200 (An API error occurred)');
          expect(err.statusCode).toBe(200);
          expect(err.type).toBe('github_error');
        });
    });

    test('should handle error response with 200 status', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 200,
          data: { message: 'Error' },
        },
      });
      const client = github();
      return client.getUserDetails('token').catch((error) => {
        expect(error.response.status).toBe(200);
        expect(error.response.data.message).toBe('Error');
        });
    });

    test('should handle OAuth error response', () => {
      const error = {
        response: {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          data: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
            error_uri: `${mockValues.GITHUB_DOCS_URL}/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps`
          }
        }
      };

      mockAxios.post.mockRejectedValue(error);

      const client = github();
      return client.getToken('invalid_code')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe(
            'GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)'
          );
          expect(err.statusCode).toBe(400);
          expect(err.type).toBe('github_error');

          const expectedCall = [
            `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
            {
              client_id: mockValues.GITHUB_CLIENT_ID,
              client_secret: mockValues.GITHUB_CLIENT_SECRET,
              code: 'invalid_code',
              redirect_uri: mockValues.COGNITO_REDIRECT_URI
            },
            {
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              timeout: 10000
            }
          ];

          expect(mockAxios.post.mock.calls[0]).toEqual(expectedCall);
        });
    });

    test('should handle successful user emails request', () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: [
          {
            email: 'test@example.com',
            primary: true,
            verified: true
          }
        ]
      });

      const client = github();
      return client.getUserEmails('token')
        .then(data => {
          expect(data).toEqual([
            {
              email: 'test@example.com',
              primary: true,
              verified: true
            }
          ]);
        });
    });

    test('should handle unauthorized request for user emails with bad credentials', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 401,
          data: {
            message: 'Bad credentials'
          }
        }
      });

      const client = github();
      return client.getUserEmails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 401 (Bad credentials)');
          expect(err.statusCode).toBe(401);
          expect(err.type).toBe('github_error');
        });
    });

    test('should properly URL encode parameters with special characters', async () => {
      const specialCode = 'test+code&special=true';
      const expectedEncodedBody = `client_id=mock-client-id&client_secret=mock-client-secret&code=test%2Bcode%26special%3Dtrue&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback`;
      
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: 'test_token' }
      });

      await github().getToken(specialCode);

      const actualCall = mockAxios.post.mock.calls[0];
      const actualUrl = actualCall[0];
      const actualData = actualCall[1];
      
      // Verify the URL remains unchanged
      expect(actualUrl).toBe(`${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`);
      
      // Convert the data object to URL encoded string
      const actualEncodedBody = qs.stringify(actualData);
      
      // Verify the body is properly encoded
      expect(actualEncodedBody).toBe(expectedEncodedBody);
    });

    test('should properly parse urlencoded response', async () => {
      const urlEncodedResponse = 'access_token=test_token&token_type=bearer&scope=user%3Aemail';
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: urlEncodedResponse
      });

      const result = await github().getToken('test_code');
      
      expect(result).toEqual({
        access_token: 'test_token',
        token_type: 'bearer',
        scope: 'user:email'
      });
    });
  });

  describe('API Errors', () => {
    test('should handle error response with 200 status and error message', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 200,
          data: {
            message: 'An API error occurred'
          }
        }
      });

      const client = github();
      return client.getUserDetails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 200 (An API error occurred)');
          expect(err.statusCode).toBe(200);
          expect(err.type).toBe('github_error');
        });
    });

    test('should handle error response with 200 status and data message', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 200,
          data: { message: 'Error' },
        },
      });
      const client = github();
      return client.getUserDetails('token').catch((error) => {
        expect(error.response.status).toBe(200);
        expect(error.response.data.message).toBe('Error');
        });
    });

    test('should handle OAuth error response', () => {
      const error = {
        response: {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          data: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
            error_uri: `${mockValues.GITHUB_DOCS_URL}/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps`
          }
        }
      };

      mockAxios.post.mockRejectedValue(error);

      const client = github();
      return client.getToken('invalid_code')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe(
            'GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)'
          );
          expect(err.statusCode).toBe(400);
          expect(err.type).toBe('github_error');

          const expectedCall = [
            `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
            {
              client_id: mockValues.GITHUB_CLIENT_ID,
              client_secret: mockValues.GITHUB_CLIENT_SECRET,
              code: 'invalid_code',
              redirect_uri: mockValues.COGNITO_REDIRECT_URI
            },
            {
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              timeout: 10000
            }
          ];

          expect(mockAxios.post.mock.calls[0]).toEqual(expectedCall);
        });
    });

    test('should handle successful user emails request', () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: [
          {
            email: 'test@example.com',
            primary: true,
            verified: true
          }
        ]
      });

      const client = github();
      return client.getUserEmails('token')
        .then(data => {
          expect(data).toEqual([
            {
              email: 'test@example.com',
              primary: true,
              verified: true
            }
          ]);
        });
    });

    test('should handle unauthorized request for user emails with bad credentials', () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 401,
          data: {
            message: 'Bad credentials'
          }
        }
      });

      const client = github();
      return client.getUserEmails('token')
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe('GitHub API responded with a failure: 401 (Bad credentials)');
          expect(err.statusCode).toBe(401);
          expect(err.type).toBe('github_error');
        });
    });

    test('should properly URL encode parameters with special characters', async () => {
      const specialCode = 'test+code&special=true';
      const expectedEncodedBody = `client_id=mock-client-id&client_secret=mock-client-secret&code=test%2Bcode%26special%3Dtrue&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback`;
      
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: { access_token: 'test_token' }
      });

      await github().getToken(specialCode);

      const actualCall = mockAxios.post.mock.calls[0];
      const actualUrl = actualCall[0];
      const actualData = actualCall[1];
      
      // Verify the URL remains unchanged
      expect(actualUrl).toBe(`${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`);
      
      // Convert the data object to URL encoded string
      const actualEncodedBody = qs.stringify(actualData);
      
      // Verify the body is properly encoded
      expect(actualEncodedBody).toBe(expectedEncodedBody);
    });

    test('should properly parse urlencoded response', async () => {
      const urlEncodedResponse = 'access_token=test_token&token_type=bearer&scope=user%3Aemail';
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: urlEncodedResponse
      });

      const result = await github().getToken('test_code');
      
      expect(result).toEqual({
        access_token: 'test_token',
        token_type: 'bearer',
        scope: 'user:email'
      });
    });
  });

  describe('User Info Errors', () => {
    test('should handle error response with 401 status', async () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      });

      const client = github();
      await expect(client.getUserDetails('bad_token')).rejects.toMatchObject({
        message: 'GitHub API responded with a failure: 401 (Unauthorized)',
        statusCode: 401,
        type: 'github_error'
      });
    });

    test('should handle error response without primary email', async () => {
      const userDetails = {
        html_url: `${mockValues.GITHUB_LOGIN_URL}/octocat`,
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

      mockAxios.get
        .mockResolvedValueOnce({
          status: 200,
          data: userDetails
        })
        .mockResolvedValueOnce({
          status: 200,
          data: userEmails
        });

      const client = github();
      await expect(client.getUserInfo('token_without_primary_email')).rejects.toThrow(
        'User did not have a primary email address'
      );
    });
  });

  describe('Token Errors', () => {
    test('should handle error response with bad code', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.'
          }
        }
      });

      await expect(
        github().getToken('bad_code')
      ).rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)');
    });
  });
});

afterAll(() => {
  jest.useRealTimers();
});
