const { mockAxios, mockGetAxios, mockAxiosCreate } = require('./sharedMocks');
const { mockValues } = require('./mocks');

describe('GitHub Client - User Operations', () => {
  let provider;
  let github;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Store original env
  const originalEnv = { ...process.env };

  beforeAll(() => {
    // Set environment variables before requiring github
    process.env.GITHUB_CLIENT_ID = mockValues.GITHUB_CLIENT_ID;
    process.env.GITHUB_CLIENT_SECRET = mockValues.GITHUB_CLIENT_SECRET;
    process.env.COGNITO_REDIRECT_URI = mockValues.COGNITO_REDIRECT_URI;
    process.env.GITHUB_API_URL = mockValues.GITHUB_API_URL;
    process.env.GITHUB_LOGIN_URL = mockValues.GITHUB_LOGIN_URL;

    // Now require github after env vars are set
    github = require('./github');
  });

  afterAll(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('getUserDetails', () => {
    test('should return user details for valid token', async () => {
      const mockResponse = {
        data: {
          id: '12345',
          login: 'testuser',
          name: 'Test User'
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const client = github();
      const userDetails = await client.getUserDetails('mock_access_token');
      expect(userDetails).toEqual(mockResponse.data);
      expect(mockAxios.get).toHaveBeenCalledWith(`${mockValues.GITHUB_API_URL}/user`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: 'token mock_access_token',
        },
        timeout: 10000
      });
    });

    test('should handle error response for user details', async () => {
      mockAxios.get.mockRejectedValue({
        response: { status: 404, data: { message: 'Not Found' } },
      });

      const client = github();
      await expect(client.getUserDetails('invalid_token')).rejects.toThrow('Not Found');
    });
  });

  describe('getUserEmails', () => {
    test('with valid token', async () => {
      const accessToken = 'valid_token';
      const expectedResponse = [
        {
          email: 'octocat@github.com',
          verified: true,
          primary: true,
          visibility: 'public',
        },
      ];

      mockAxios.get.mockResolvedValueOnce({
        status: 200,
        data: expectedResponse,
      });

      const client = github();
      const result = await client.getUserEmails(accessToken);
      expect(result).toEqual(expectedResponse);
      expect(mockAxios.get).toHaveBeenCalledWith(
        `${mockValues.GITHUB_API_URL}/user/emails`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${accessToken}`,
          },
          timeout: 10000
        }
      );
    });

    test('with invalid token', async () => {
      const accessToken = 'invalid_token';
      mockAxios.get.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Bad credentials' } },
      });

      const client = github();
      await expect(client.getUserEmails(accessToken)).rejects.toThrow('Bad credentials');
      expect(mockAxios.get).toHaveBeenCalledWith(
        `${mockValues.GITHUB_API_URL}/user/emails`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${accessToken}`,
          },
          timeout: 10000
        }
      );
    });
  });
});
