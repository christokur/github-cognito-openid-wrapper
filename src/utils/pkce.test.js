const PkceHelper = require('./pkce');

describe('PkceHelper', () => {
  beforeEach(() => {
    // Clear the verifier store before each test
    PkceHelper._getVerifierStore().clear();
  });

  describe('generateCodeVerifier', () => {
    it('should generate a base64url-encoded string', () => {
      const verifier = PkceHelper.generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      // Base64URL format should not contain +, / or =
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      // Should be 43 characters (32 bytes in base64)
      expect(verifier).toHaveLength(43);
    });

    it('should generate unique values on each call', () => {
      const verifier1 = PkceHelper.generateCodeVerifier();
      const verifier2 = PkceHelper.generateCodeVerifier();
      expect(verifier1).not.toEqual(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a valid code challenge from verifier', () => {
      const verifier = 'test-verifier';
      const challenge = PkceHelper.generateCodeChallenge(verifier);
      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      // Base64URL format should not contain +, / or =
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate consistent challenges for the same verifier', () => {
      const verifier = 'test-verifier';
      const challenge1 = PkceHelper.generateCodeChallenge(verifier);
      const challenge2 = PkceHelper.generateCodeChallenge(verifier);
      expect(challenge1).toEqual(challenge2);
    });

    it('should generate different challenges for different verifiers', () => {
      const challenge1 = PkceHelper.generateCodeChallenge('verifier1');
      const challenge2 = PkceHelper.generateCodeChallenge('verifier2');
      expect(challenge1).not.toEqual(challenge2);
    });
  });

  describe('storeCodeVerifier', () => {
    it('should store verifier for given state', () => {
      const state = 'test-state';
      const verifier = 'test-verifier';
      PkceHelper.storeCodeVerifier(state, verifier);
      expect(PkceHelper._getVerifierStore().get(state)).toEqual(verifier);
    });

    it('should throw error if state is missing', () => {
      expect(() => PkceHelper.storeCodeVerifier(null, 'test-verifier')).toThrow();
    });

    it('should throw error if verifier is missing', () => {
      expect(() => PkceHelper.storeCodeVerifier('test-state', null)).toThrow();
    });

    it('should overwrite existing verifier for same state', () => {
      const state = 'test-state';
      PkceHelper.storeCodeVerifier(state, 'verifier1');
      PkceHelper.storeCodeVerifier(state, 'verifier2');
      expect(PkceHelper._getVerifierStore().get(state)).toEqual('verifier2');
    });
  });

  describe('getCodeVerifier', () => {
    it('should retrieve stored verifier and remove it', () => {
      const state = 'test-state';
      const verifier = 'test-verifier';
      PkceHelper.storeCodeVerifier(state, verifier);
      expect(PkceHelper.getCodeVerifier(state)).toEqual(verifier);
      expect(PkceHelper._getVerifierStore().has(state)).toBeFalsy();
    });

    it('should return null for non-existent state', () => {
      expect(PkceHelper.getCodeVerifier('non-existent')).toBeNull();
    });

    it('should handle undefined state parameter', () => {
      expect(PkceHelper.getCodeVerifier()).toBeNull();
    });
  });

  describe('end-to-end PKCE flow', () => {
    it('should work for a complete PKCE flow', () => {
      // Generate verifier and challenge
      const verifier = PkceHelper.generateCodeVerifier();
      const challenge = PkceHelper.generateCodeChallenge(verifier);

      // Store verifier with state
      const state = 'test-state';
      PkceHelper.storeCodeVerifier(state, verifier);

      // Retrieve and verify
      const retrievedVerifier = PkceHelper.getCodeVerifier(state);
      expect(retrievedVerifier).toEqual(verifier);

      // Verify challenge still matches
      const newChallenge = PkceHelper.generateCodeChallenge(retrievedVerifier);
      expect(newChallenge).toEqual(challenge);
    });
  });
});
