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

const mockRateLimiter = {
  checkLimit: jest.fn(),
  updateLimits: jest.fn(),
  isRateLimitError: jest.fn().mockReturnValue(false)
};

jest.mock('./utils/rate-limiter', () => mockRateLimiter);

const githubClient = require('./github');
let github;

beforeAll(() => {
  github = githubClient('https://api.github.com', 'https://github.com');
});

describe('User Details and Emails', () => {
  const mockAccessToken = 'mock-access-token';
  const mockUserResponse = {
    data: {
      id: '12345',
      login: 'testuser',
      name: 'Test User'
    },
    headers: {},
    status: 200
  };

  const mockEmailsResponse = {
    data: [
      {
        email: 'test@example.com',
        primary: true,
        verified: true
      }
    ],
    headers: {},
    status: 200
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.get.mockReset();
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
          message: 'API rate limit exceeded'
        },
        headers: {
          'x-ratelimit-remaining': '0'
        }
      }
    };
    mockRateLimiter.isRateLimitError.mockReturnValue(true);
    mockRateLimiter.checkLimit.mockImplementation(() => {
      throw new Error('GitHub API responded with a failure: 429 (API rate limit exceeded)');
    });
    mockAxios.get.mockRejectedValue(rateLimitError);

    return github.getUserDetails(mockAccessToken)
      .then(() => {
        throw new Error('Expected promise to reject');
      })
      .catch(err => {
        expect(err.message).toBe('GitHub API responded with a failure: 429 (API rate limit exceeded)');
        expect(mockRateLimiter.updateLimits).toHaveBeenCalledWith(rateLimitError.response.headers);
      });
  }, 30000);
});
