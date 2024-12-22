const { mockAxios } = require('../sharedMocks');
const { mockValues } = require('../mocks');

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
    it('should generate and return authorization URL successfully', () => {
      // Mock PKCE
      jest.spyOn(PkceHelper, 'generateCodeVerifier').mockReturnValue(mockCodeVerifier);
      jest.spyOn(PkceHelper, 'generateCodeChallenge').mockReturnValue(mockCodeChallenge);
      jest.spyOn(ConfigurationService, 'validateAuthorizationParams').mockImplementation(() => true);

      // Call the service
      const result = AuthorizationService.getAuthorizeUrl({
        client_id: mockClientId,
        scope: mockScope,
        state: mockState,
        response_type: mockResponseType,
        nonce: mockNonce
      });

      // Verify the URL format
      expect(result).toMatch(new RegExp(`^${mockValues.GITHUB_LOGIN_URL}/login/oauth/authorize`));
      expect(result).toMatch(`client_id=${mockClientId}`);
      expect(result).toMatch(`scope=${encodeURIComponent(mockScope)}`);
      expect(result).toMatch(`state=${mockState}`);
      expect(result).toMatch(`response_type=${mockResponseType}`);
      expect(result).toMatch(`nonce=${mockNonce}`);
      expect(result).toMatch(`code_challenge=${mockCodeChallenge}`);
      expect(result).toMatch('code_challenge_method=S256');

      // Verify method calls
      expect(ConfigurationService.validateAuthorizationParams).toHaveBeenCalledWith({
        client_id: mockClientId,
        scope: mockScope,
        state: mockState,
        response_type: mockResponseType,
        nonce: mockNonce
      });
      expect(PkceHelper.generateCodeVerifier).toHaveBeenCalled();
      expect(PkceHelper.generateCodeChallenge).toHaveBeenCalledWith(mockCodeVerifier);
    });

    it('should handle validation errors', () => {
      jest.spyOn(ConfigurationService, 'validateAuthorizationParams').mockImplementation(() => {
        throw new Error('Validation failed');
      });

      expect(() => AuthorizationService.getAuthorizeUrl({
        client_id: mockClientId,
        scope: mockScope,
        state: mockState,
        response_type: mockResponseType,
        nonce: mockNonce
      })).toThrow('Validation failed');
    });

    it('should handle PKCE generation errors', () => {
      jest.spyOn(PkceHelper, 'generateCodeVerifier').mockImplementation(() => {
        throw new Error('PKCE generation failed');
      });

      expect(() => AuthorizationService.getAuthorizeUrl({
        client_id: mockClientId,
        scope: mockScope,
        state: mockState,
        response_type: mockResponseType,
        nonce: mockNonce
      })).toThrow('PKCE generation failed');
    });

    it('should handle GitHub client errors', () => {
      jest.spyOn(PkceHelper, 'generateCodeVerifier').mockReturnValue(mockCodeVerifier);
      jest.spyOn(PkceHelper, 'generateCodeChallenge').mockImplementation(() => {
        throw new Error('GitHub client error');
      });

      expect(() => AuthorizationService.getAuthorizeUrl({
        client_id: mockClientId,
        scope: mockScope,
        state: mockState,
        response_type: mockResponseType,
        nonce: mockNonce
      })).toThrow('GitHub client error');
    });
  });
});
