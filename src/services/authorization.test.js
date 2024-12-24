const { mockAxios } = require('../sharedMocks');
const { mockValues } = require('../mocks');

// Mock Configuration
jest.mock('../config', () => ({
  GITHUB_API_URL: mockValues.GITHUB_API_URL,
  GITHUB_LOGIN_URL: mockValues.GITHUB_LOGIN_URL,
  COGNITO_REDIRECT_URI: 'http://localhost/callback',
}));

const { GITHUB_LOGIN_URL } = mockValues;

// Mock GitHub client
jest.mock('../github');

const mockGitHubUrl = `${GITHUB_LOGIN_URL}/login/oauth/authorize?client_id=test-client-id&scope=user%3Aemail&state=test-state&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&nonce=test-nonce&code_challenge=test-code-challenge&code_challenge_method=S256`;

let AuthorizationService;
let Configuration;
let ConfigurationService;
let PkceHelper;
let github;

describe('AuthorizationService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Configuration = require('../config');
    github = require('../github');
    AuthorizationService = require('./authorization');
    ConfigurationService = require('./configuration');
    PkceHelper = require('../utils/pkce');

    // Setup default successful mocks
    jest.spyOn(ConfigurationService, 'validateAuthorizationParams')
      .mockImplementation(() => undefined);
    jest.spyOn(PkceHelper, 'generateCodeVerifier')
      .mockReturnValue(mockCodeVerifier);
    jest.spyOn(PkceHelper, 'generateCodeChallenge')
      .mockReturnValue(mockCodeChallenge);

    // Setup default GitHub client mock
    github.mockImplementation(() => ({
      getAuthorizeUrl: () => mockGitHubUrl,
      getApiEndpoints: () => ({
        userDetails: `${mockValues.GITHUB_API_URL}/user`,
        userEmails: `${mockValues.GITHUB_API_URL}/user/emails`,
        oauthToken: `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
        oauthAuthorize: `${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize`,
      }),
    }));
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./authorization')];
    delete require.cache[require.resolve('./configuration')];
    delete require.cache[require.resolve('../utils/pkce')];
    delete require.cache[require.resolve('../github')];
    delete require.cache[require.resolve('../config')];
    delete require.cache[require.resolve('../connectors/logger')];
  });

  const mockClientId = 'test-client-id';
  const mockScope = 'user:email';
  const mockState = 'test-state';
  const mockResponseType = 'code';
  const mockNonce = 'test-nonce';
  const mockCodeVerifier = 'test-code-verifier';
  const mockCodeChallenge = 'test-code-challenge';

  describe('getAuthorizeUrl', () => {
    it('should generate and return authorization URL successfully', async () => {
      // Call the service
      const result = await AuthorizationService.getAuthorizeUrl({
        client_id: mockClientId,
        scope: mockScope,
        state: mockState,
        response_type: mockResponseType,
        nonce: mockNonce,
      });

      // Verify the URL format
      expect(result).toMatch(
        new RegExp(`^${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize`),
      );
      expect(result).toMatch(`client_id=${mockClientId}`);
      expect(result).toMatch(`scope=${encodeURIComponent(mockScope)}`);
      expect(result).toMatch(`state=${mockState}`);
      expect(result).toMatch(`response_type=${mockResponseType}`);
      expect(result).toMatch(`nonce=${mockNonce}`);
      expect(result).toMatch(`code_challenge=${mockCodeChallenge}`);
      expect(result).toMatch('code_challenge_method=S256');
      expect(result).toMatch(`redirect_uri=${encodeURIComponent(Configuration.COGNITO_REDIRECT_URI)}`);

      // Verify method calls
      expect(
        ConfigurationService.validateAuthorizationParams,
      ).toHaveBeenCalledWith({
        client_id: mockClientId,
        scope: mockScope,
        state: mockState,
        response_type: mockResponseType,
        nonce: mockNonce,
      });
      expect(PkceHelper.generateCodeVerifier).toHaveBeenCalled();
      expect(PkceHelper.generateCodeChallenge).toHaveBeenCalledWith(
        mockCodeVerifier,
      );
    });

    it('should handle validation errors', async () => {
      // Reset mock to throw error
      jest.spyOn(ConfigurationService, 'validateAuthorizationParams')
        .mockImplementation(() => {
          throw new Error('Validation failed');
        });

      await expect(
        AuthorizationService.getAuthorizeUrl({
          client_id: mockClientId,
          scope: mockScope,
          state: mockState,
          response_type: mockResponseType,
          nonce: mockNonce,
        }),
      ).rejects.toThrow('Validation failed');
    });

    it('should handle PKCE generation errors', async () => {
      jest.spyOn(PkceHelper, 'generateCodeVerifier').mockImplementation(() => {
        throw new Error('PKCE generation failed');
      });

      await expect(
        AuthorizationService.getAuthorizeUrl({
          client_id: mockClientId,
          scope: mockScope,
          state: mockState,
          response_type: mockResponseType,
          nonce: mockNonce,
        }),
      ).rejects.toThrow('PKCE generation failed');
    });

    it('should handle GitHub client errors', async () => {
      // Mock the GitHub client to throw an error
      github.mockImplementation(() => ({
        getAuthorizeUrl: () => {
          throw new Error('GitHub client error');
        },
        getApiEndpoints: () => ({
          userDetails: `${mockValues.GITHUB_API_URL}/user`,
          userEmails: `${mockValues.GITHUB_API_URL}/user/emails`,
          oauthToken: `${mockValues.GITHUB_LOGIN_URL}/login/oauth/access_token`,
          oauthAuthorize: `${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize`,
        }),
      }));

      await expect(
        AuthorizationService.getAuthorizeUrl({
          client_id: mockClientId,
          scope: mockScope,
          state: mockState,
          response_type: mockResponseType,
          nonce: mockNonce,
        }),
      ).rejects.toThrow('GitHub client error');
    });
  });
});
