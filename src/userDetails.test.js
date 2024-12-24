const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

const mockRateLimiter = {
  checkLimit: jest.fn(),
  updateLimits: jest.fn(),
  isRateLimitError: jest.fn().mockReturnValue(false),
};

jest.mock('./utils/rate-limiter', () => mockRateLimiter);

const githubClient = require('./github');

let github;

describe('User Details and Emails', () => {
  const mockAccessToken = 'mock-access-token';
  const mockUserResponse = {
    data: {
      id: '12345',
      login: 'testuser',
      name: 'Test User',
    },
    headers: {},
    status: 200,
  };

  const mockEmailsResponse = {
    data: [
      {
        email: 'test@example.com',
        primary: true,
        verified: true,
      },
    ],
    headers: {},
    status: 200,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.get.mockReset();
    github = githubClient(
      mockValues.GITHUB_API_URL,
      mockValues.GITHUB_LOGIN_URL,
    );
  });

  it('should fetch user details successfully', async () => {
    mockAxios.get.mockResolvedValue(mockUserResponse);
    const result = await github.getUserDetails(mockAccessToken);
    expect(result).toEqual(mockUserResponse.data);
  }, 30000);

  it('should fetch user emails successfully', async () => {
    mockAxios.get.mockResolvedValue(mockEmailsResponse);
    const result = await github.getUserEmails(mockAccessToken);
    expect(result).toEqual(mockEmailsResponse.data);
  }, 30000);

  it('should handle rate limit errors', () => {
    const rateLimitError = {
      response: {
        status: 403,
        data: {
          message: 'API rate limit exceeded',
        },
        headers: {
          'x-ratelimit-remaining': '0',
        },
      },
    };
    mockRateLimiter.isRateLimitError.mockReturnValue(true);
    mockRateLimiter.checkLimit.mockImplementation(() => {
      throw new Error(
        'GitHub API responded with a failure: 429 (API rate limit exceeded)',
      );
    });
    mockAxios.get.mockRejectedValue(rateLimitError);

    return github
      .getUserDetails(mockAccessToken)
      .then(() => {
        throw new Error('Expected promise to reject');
      })
      .catch((err) => {
        expect(err.message).toBe(
          'GitHub API responded with 403: API rate limit exceeded'
        );
        expect(mockRateLimiter.updateLimits).toHaveBeenCalledWith(
          rateLimitError.response.headers,
        );
      });
  }, 30000);
});
