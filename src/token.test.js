const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn()
};

jest.mock('./helpers', () => ({
  getAxios: jest.fn(() => mockAxios)
}));

const githubClient = require('./github');
let github;

beforeAll(() => {
  github = githubClient('https://api.github.com', 'https://github.com');
});

describe('Token Handling', () => {
  const mockClientId = 'mock-client-id';
  const mockClientSecret = 'mock-client-secret';
  const mockRedirectUri = 'http://localhost/callback';
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
