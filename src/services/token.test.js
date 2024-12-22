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
    Configuration = require('../config');
    github = require('../github');
    TokenService = require('./token');
    crypto = require('../crypto');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../config')];
    delete require.cache[require.resolve('../github')];
    delete require.cache[require.resolve('../connectors/logger')];
    delete require.cache[require.resolve('./token')];
    delete require.cache[require.resolve('../crypto')];
  });

  const mockCode = 'test-code';
  const mockGithubToken = {
    access_token: 'test-token',
    scope: 'user:email,repo'
  };
  const mockNonce = 'test-nonce';
  const mockState = 'test-state';
  const mockCodeVerifier = 'test-verifier';
  const mockHost = 'test-host';

  describe('getJwks', () => {
    it('should return JWKS successfully', async () => {
      const jwks = await TokenService.getJwks();
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

      const wrappedPromise = new Promise((resolve, reject) => {
        try {
          TokenService.getJwks();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      return wrappedPromise
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe(errorMessage);
        });
    });
  });

  describe('getGithubToken', () => {
    it('should exchange code for token successfully', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken
      });

      const client = github(mockValues.GITHUB_API_URL, mockValues.GITHUB_LOGIN_URL);
      const token = await TokenService.getGithubToken(mockCode);
      expect(token).toEqual({
        access_token: mockGithubToken.access_token,
        scope: 'openid user:email repo'
      });
    });

    it('should exchange code for token successfully with state and code_verifier', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken
      });

      const client = github(mockValues.GITHUB_API_URL, mockValues.GITHUB_LOGIN_URL);
      const token = await TokenService.getGithubToken(mockCode, mockState, mockCodeVerifier);
      expect(token).toEqual({
        access_token: mockGithubToken.access_token,
        scope: 'openid user:email repo'
      });
    });

    it('should handle GitHub API errors', async () => {
      const errorMessage = 'Invalid code';
      mockAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { error: errorMessage }
        }
      });

      await expect(TokenService.getGithubToken(mockCode)).rejects.toThrow(errorMessage);
    });
  });

  describe('createIdToken', () => {
    const payload = {
      sub: 'test-subject',
      email: 'test@example.com'
    };

    it('should create ID token successfully', async () => {
      const token = await TokenService.createIdToken(payload, mockHost);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should handle crypto errors', () => {
      const errorMessage = 'Failed to create ID token: Mock error';
      jest.spyOn(crypto, 'makeIdToken').mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const wrappedPromise = new Promise((resolve, reject) => {
        try {
          TokenService.createIdToken(payload, mockHost);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      return wrappedPromise
        .then(() => {
          throw new Error('Expected promise to reject');
        })
        .catch(err => {
          expect(err).toBeTruthy();
          expect(err.message).toBe(errorMessage);
        });
    });
  });

  describe('processTokenExchange', () => {
    const mockUserDetails = {
      id: 12345,
      name: 'Test User',
      login: 'testuser'
    };

    const mockUserEmails = [
      {
        email: 'test@example.com',
        primary: true,
        verified: true
      }
    ];

    beforeEach(() => {
      mockAxios.get.mockImplementation((url) => {
        if (url.endsWith('/user')) {
          return Promise.resolve({
            status: 200,
            data: mockUserDetails
          });
        } if (url.endsWith('/user/emails')) {
          return Promise.resolve({
            status: 200,
            data: mockUserEmails
          });
        }
      });
    });

    it('should process token exchange successfully with nonce', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken
      });

      const result = await TokenService.processTokenExchange({
        code: mockCode,
        state: mockState,
        codeVerifier: mockCodeVerifier,
        host: mockHost,
        nonce: mockNonce
      });

      expect(result).toBeDefined();
      expect(result.access_token).toBe(mockGithubToken.access_token);
      expect(result.id_token).toBeDefined();
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user'),
        expect.any(Object)
      );
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user/emails'),
        expect.any(Object)
      );
    });

    it('should process token exchange successfully without nonce', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken
      });

      const result = await TokenService.processTokenExchange({
        code: mockCode,
        state: mockState,
        codeVerifier: mockCodeVerifier,
        host: mockHost
      });

      expect(result).toBeDefined();
      expect(result.access_token).toBe(mockGithubToken.access_token);
      expect(result.id_token).toBeDefined();
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user'),
        expect.any(Object)
      );
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user/emails'),
        expect.any(Object)
      );
    });

    it('should handle GitHub token errors', async () => {
      const errorMessage = 'Invalid code';
      mockAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { error: errorMessage }
        }
      });

      await expect(TokenService.processTokenExchange({
        code: mockCode,
        state: mockState,
        codeVerifier: mockCodeVerifier,
        host: mockHost
      })).rejects.toThrow(errorMessage);
    });

    it('should handle ID token creation errors', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockGithubToken
      });

      const errorMessage = 'Failed to create ID token: Mock error';
      jest.spyOn(crypto, 'makeIdToken').mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(TokenService.processTokenExchange({
        code: mockCode,
        state: mockState,
        codeVerifier: mockCodeVerifier,
        host: mockHost
      })).rejects.toThrow(errorMessage);
    });
  });
});
