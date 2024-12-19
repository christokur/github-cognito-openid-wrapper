const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn()
};

jest.mock('./helpers', () => ({
  getAxios: jest.fn(() => mockAxios)
}));

// Mocking process.env values
process.env.GITHUB_CLIENT_ID = 'mock_client_id';
process.env.GITHUB_CLIENT_SECRET = 'mock_client_secret';

const Configuration = require('./config');
const githubClient = require('./github');
let github;

beforeAll(() => {
  github = githubClient('https://api.github.com', 'https://github.com');
});

describe('Token Handling', () => {
  const mockClientId = Configuration.GITHUB_CLIENT_ID;
  const mockClientSecret = Configuration.GITHUB_CLIENT_SECRET;
  const mockRedirectUri = Configuration.COGNITO_REDIRECT_URI;
  const mockAccessToken = 'mock-access-token';
  const mockState = 'mock-state';
  const mockVerifier = 'mock-verifier';

  const mockResponse = {
    data: {
      access_token: mockAccessToken,
      token_type: 'bearer',
      scope: 'user:email'
    },
    headers: {},
    status: 200
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.post.mockReset();
  });

  it('should exchange code for token successfully', async () => {
    mockAxios.post.mockResolvedValue(mockResponse);
    const result = await github.getToken('code', mockState, mockVerifier);
    expect(result).toEqual(mockResponse.data);
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://github.com/login/oauth/access_token',
      expect.stringContaining('code=code'),
      expect.any(Object)
    );
  }, 30000);

  it('should handle OAuth errors', async () => {
    const errorResponse = {
      response: {
        status: 400,
        data: {
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.'
        }
      }
    };
    mockAxios.post.mockRejectedValue(errorResponse);
    await expect(github.getToken('invalid-code', mockState)).rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)');
  }, 30000);

  it('should handle network errors', async () => {
    const networkError = new Error('Network Error');
    mockAxios.post.mockRejectedValue(networkError);
    await expect(github.getToken('code', mockState)).rejects.toThrow('Network error occurred while contacting GitHub API');
  }, 30000);
});
