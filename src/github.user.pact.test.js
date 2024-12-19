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

const github = require('./github');

describe('GitHub Client - User Operations', () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Store original env
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
    process.env.COGNITO_REDIRECT_URI = 'http://localhost/callback';
  });

  afterAll(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
  };

  jest.mock('axios', () => mockAxios);

  describe('getUserDetails', () => {
    test('with valid token', async () => {
      const accessToken = 'valid_token';
      const expectedResponse = { id: 1, name: 'Test User' };

      mockAxios.get.mockResolvedValueOnce({
        status: 200,
        data: expectedResponse,
      });

      const result = await github.getUserDetails(accessToken);
      expect(result).toEqual(expectedResponse);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user'),
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
            Authorization: `token ${accessToken}`,
          },
        })
      );
    });

    test('with invalid token', async () => {
      const accessToken = 'invalid_token';
      mockAxios.get.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Bad credentials' } },
      });

      await expect(github.getUserDetails(accessToken)).rejects.toThrow('Bad credentials');
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user'),
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
            Authorization: `token ${accessToken}`,
          },
        })
      );
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

      const result = await github.getUserEmails(accessToken);
      expect(result).toEqual(expectedResponse);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user/emails'),
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
            Authorization: `token ${accessToken}`,
          },
        })
      );
    });

    test('with invalid token', async () => {
      const accessToken = 'invalid_token';
      mockAxios.get.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Bad credentials' } },
      });

      await expect(github.getUserEmails(accessToken)).rejects.toThrow('Bad credentials');
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user/emails'),
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
            Authorization: `token ${accessToken}`,
          },
        })
      );
    });
  });
});
