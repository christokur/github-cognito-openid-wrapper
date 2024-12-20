const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

const Configuration = require('./config');
const githubClient = require('./github');
const { mockValues } = require('./mocks');
let github;

beforeAll(() => {
  github = githubClient(mockValues.GITHUB_API_URL, mockValues.GITHUB_LOGIN_URL);
});

describe('Token Handling', () => {
  const mockClientId = Configuration.GITHUB_CLIENT_ID;
  const mockClientSecret = Configuration.GITHUB_CLIENT_SECRET;
  const mockRedirectUri = mockValues.COGNITO_REDIRECT_URI;
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
      `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
      {
        client_id: mockClientId,
        client_secret: mockClientSecret,
        code: 'code',
        redirect_uri: mockRedirectUri
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: expect.any(Number),
        transformRequest: [(data) => data]
      }
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
