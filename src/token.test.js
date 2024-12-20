const { mockAxios, mockGetAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

describe('Token Handling', () => {
  const mockClientId = mockValues.GITHUB_CLIENT_ID;
  const mockClientSecret = mockValues.GITHUB_CLIENT_SECRET;
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

  let Configuration;
  let github;
  let client;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Configuration = require('./config');
    github = require('./github');
    client = github(mockValues.GITHUB_API_URL, mockValues.GITHUB_LOGIN_URL);
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./config')];
    delete require.cache[require.resolve('./github')];
    delete require.cache[require.resolve('./connectors/logger')];
  });

  it('should exchange code for token successfully', async () => {
    mockAxios.post.mockResolvedValue(mockResponse);
    const result = await client.getToken('code', mockState, mockVerifier);
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
        transformRequest: expect.any(Array)
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
    await expect(client.getToken('invalid-code', mockState)).rejects.toThrow('GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)');
  }, 30000);

  it('should handle network errors', async () => {
    const networkError = new Error('Network Error');
    mockAxios.post.mockRejectedValue(networkError);
    await expect(client.getToken('code', mockState)).rejects.toThrow('Network error occurred while contacting GitHub API');
  }, 30000);
});
