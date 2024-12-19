const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn()
};
const mockGetAxios = jest.fn(() => mockAxios);

// !AI: Leave this alone
const noDelay = () => {
  return 0;
};

// const { exponentialBackoff } = require('./utils/retry');
// Mock the actual retry module that's being used
jest.mock('./utils/retry', () => ({
  ...jest.requireActual('./utils/retry'),
  exponentialBackoff: noDelay
}));
// !AI: Leave this alone

jest.mock('./helpers', () => ({
  getAxios: mockGetAxios,
  NumericDate: jest.requireActual('./helpers').NumericDate
}));

jest.mock('./config', () => ({
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  COGNITO_REDIRECT_URI: 'http://localhost/callback',
  GITHUB_API_URL: 'http://api.github.com',
  GITHUB_LOGIN_URL: 'http://github.com',
}));

const github = require('./github');

describe('GitHub Client - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Network and Server Errors', () => {
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
  });

  describe('API Errors', () => {
    test('should handle error response with 200 status', () => {
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

    test('should handle OAuth error response', () => {
      const error = {
        response: {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          data: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
            error_uri: 'https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps'
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

          expect(mockAxios.post).toHaveBeenCalledWith(
            'http://github.com/login/oauth/access_token',
            'client_id=test-client-id&client_secret=test-client-secret&code=invalid_code&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback',
            {
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              timeout: 10000
            }
          );
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
  });
});

afterAll(() => {
  jest.useRealTimers();
});
