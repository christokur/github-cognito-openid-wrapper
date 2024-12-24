const { mockAxios } = require('../sharedMocks');
const { mockValues } = require('../mocks');

let Configuration;
let github;
let TokenService;
let crypto;

describe('TokenService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock Configuration values
    Configuration = require('../config');
    Configuration.GITHUB_API_URL = mockValues.GITHUB_API_URL;
    Configuration.GITHUB_LOGIN_URL = mockValues.GITHUB_LOGIN_URL;

    github = require('../github');
    TokenService = require('./token');
    crypto = require('../crypto');
  });

  afterEach(() => {
    jest.resetModules();
    if (mockAxios.reset) {
      mockAxios.reset();
    }
    delete require.cache[require.resolve('../config')];
    delete require.cache[require.resolve('../github')];
    delete require.cache[require.resolve('../connectors/logger')];
    delete require.cache[require.resolve('./token')];
    delete require.cache[require.resolve('../crypto')];
  });

  const mockCode = 'test-code';
  const mockGithubToken = {
    access_token: 'test-token',
    scope: 'user:email,repo',
  };
  const mockNonce = 'test-nonce';
  const mockState = 'test-state';
  const mockCodeVerifier = 'test-verifier';
  const mockHost = 'test-host';

  describe('getJwks', () => {
    it('should return JWKS successfully', () => {
      const jwks = TokenService.getJwks();
      expect(jwks).toBeDefined();
      expect(jwks.keys).toBeInstanceOf(Array);
      expect(jwks.keys[0]).toHaveProperty('kid');
      expect(jwks.keys[0]).toHaveProperty('kty');
    });

    it('should handle crypto errors', () => {
      const errorMessage = 'Mock error';
      jest.spyOn(crypto, 'getPublicKey').mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => TokenService.getJwks()).toThrow(errorMessage);
    });
  });

  describe('getGithubToken', () => {
    it('should exchange code for token successfully', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken,
      });

      const token = await TokenService.getGithubToken(mockCode);
      expect(token).toEqual({
        access_token: mockGithubToken.access_token,
        scope: 'openid user:email repo',
      });
    });

    it('should exchange code for token successfully with state and code_verifier', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken,
      });

      const token = await TokenService.getGithubToken(
        mockCode,
        mockState,
        mockCodeVerifier,
      );
      expect(token).toEqual({
        access_token: mockGithubToken.access_token,
        scope: 'openid user:email repo',
      });
    });

    it('should handle GitHub API errors', async () => {
      const errorMessage = 'Invalid code';
      mockAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: errorMessage },
        },
      });

      await expect(TokenService.getGithubToken(mockCode)).rejects.toThrow(
        `GitHub API responded with 400: ${errorMessage}`,
      );
    });
  });

  describe('createIdToken', () => {
    const payload = {
      sub: 'test-subject',
      email: 'test@example.com',
    };

    it('should create ID token successfully', async () => {
      const token = await TokenService.createIdToken(payload, mockHost);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should handle crypto errors', async () => {
      const errorMessage = 'Failed to create ID token: Mock error';
      jest.spyOn(crypto, 'makeIdToken').mockRejectedValue(new Error(errorMessage));

      await expect(TokenService.createIdToken(payload, mockHost)).rejects.toThrow(
        errorMessage,
      );
    });
  });

  describe('processTokenExchange', () => {
    const mockUserDetails = {
      id: 12345,
      name: 'Test User',
      login: 'testuser',
    };

    const mockUserEmails = [
      {
        email: 'test@example.com',
        primary: true,
        verified: true,
      },
    ];

    beforeEach(() => {
      mockAxios.get.mockImplementation((url) => {
        if (url.endsWith('/user')) {
          return Promise.resolve({
            status: 200,
            data: mockUserDetails,
          });
        }
        if (url.endsWith('/user/emails')) {
          return Promise.resolve({
            status: 200,
            data: mockUserEmails,
          });
        }
      });
    });

    it('should process token exchange successfully with nonce', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken,
      });

      const result = await TokenService.processTokenExchange({
        code: mockCode,
        state: mockState,
        codeVerifier: mockCodeVerifier,
        host: mockHost,
        nonce: mockNonce,
      });

      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(result.id_token).toBeDefined();
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user'),
        expect.any(Object),
      );
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user/emails'),
        expect.any(Object),
      );
    });

    it('should process token exchange successfully without nonce', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken,
      });

      const result = await TokenService.processTokenExchange({
        code: mockCode,
        state: mockState,
        codeVerifier: mockCodeVerifier,
        host: mockHost,
      });

      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(result.id_token).toBeDefined();
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user'),
        expect.any(Object),
      );
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user/emails'),
        expect.any(Object),
      );
    });

    it('should handle GitHub token errors', async () => {
      const errorMessage = 'Invalid code';
      mockAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: errorMessage },
        },
      });

      await expect(
        TokenService.processTokenExchange({
          code: mockCode,
          state: mockState,
          codeVerifier: mockCodeVerifier,
          host: mockHost,
        }),
      ).rejects.toThrow(errorMessage);
    });
  });
});
