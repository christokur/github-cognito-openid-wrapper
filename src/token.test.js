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
      scope: 'user:email',
    },
    headers: {},
    status: 200,
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
    const result = await client.getToken('code', mockVerifier);
    expect(result).toEqual(mockResponse.data);

    const actualCall = mockAxios.post.mock.calls[0];
    expect(actualCall[0]).toBe(
      `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
    );

    console.log('Actual data:', actualCall[1]);
    console.log(
      'Parsed data:',
      Object.fromEntries(new URLSearchParams(actualCall[1])),
    );

    const actualData = Object.fromEntries(new URLSearchParams(actualCall[1]));
    const expectedData = {
      client_id: mockClientId,
      client_secret: mockClientSecret,
      code: 'code',
      redirect_uri: mockRedirectUri,
      code_verifier: mockVerifier,
      grant_type: 'authorization_code'
    };
    expect(actualData).toEqual(expectedData);

    expect(actualCall[2]).toEqual({
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });
  }, 30000);

  it('should handle OAuth errors', async () => {
    const errorResponse = {
      response: {
        status: 400,
        data: {
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        },
      },
    };
    mockAxios.post.mockRejectedValue(errorResponse);
    await expect(client.getToken('invalid-code', mockVerifier)).rejects.toThrow(
      'GitHub API responded with a failure: 400 (Bad Request - bad_verification_code: The code passed is incorrect or expired.)',
    );
  }, 30000);

  it('should handle network errors', async () => {
    const networkError = new Error('Network Error');
    mockAxios.post.mockRejectedValue(networkError);
    await expect(client.getToken('code', mockVerifier)).rejects.toThrow(
      'Network error occurred while contacting GitHub API',
    );
  }, 30000);

  it('should handle responses with special characters in token', async () => {
    const responseWithSpecialChars = {
      data: {
        access_token: 'test+token&special=true',
        token_type: 'bearer',
        scope: 'user:email+repo&more',
      },
    };
    mockAxios.post.mockResolvedValue(responseWithSpecialChars);

    const result = await client.getToken('code', mockVerifier);

    expect(result).toEqual(responseWithSpecialChars.data);
  });

  it('should handle urlencoded response format', async () => {
    const urlEncodedResponse = {
      data: 'access_token=test_token&token_type=bearer&scope=user%3Aemail%2Brepo',
    };
    mockAxios.post.mockResolvedValue(urlEncodedResponse);

    const result = await client.getToken('code', mockVerifier);

    expect(result).toEqual({
      access_token: 'test_token',
      token_type: 'bearer',
      scope: 'user:email+repo',
    });
  });
});
