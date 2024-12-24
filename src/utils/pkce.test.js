const PkceHelper = require('./pkce');

describe('PkceHelper', () => {
  beforeEach(() => {
    // Clear the verifier store before each test
    PkceHelper.verifierStore.clear();
  });

  describe('generateCodeVerifier', () => {
    it('should generate a base64url-encoded string', () => {
      const verifier = PkceHelper.generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      // Base64URL format should not contain +, / or =
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      // Should be 43 characters (32 bytes in base64)
      expect(verifier.length).toBe(43);
    });

    it('should generate unique values on each call', () => {
      const verifier1 = PkceHelper.generateCodeVerifier();
      const verifier2 = PkceHelper.generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a valid code challenge from verifier', () => {
      const verifier = 'test_verifier';
      const challenge = PkceHelper.generateCodeChallenge(verifier);
      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      // Base64URL format should not contain +, / or =
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate consistent challenges for the same verifier', () => {
      const verifier = 'test_verifier';
      const challenge1 = PkceHelper.generateCodeChallenge(verifier);
      const challenge2 = PkceHelper.generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', () => {
      const challenge1 = PkceHelper.generateCodeChallenge('verifier1');
      const challenge2 = PkceHelper.generateCodeChallenge('verifier2');
      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('storeCodeVerifier', () => {
    it('should store verifier for given state', () => {
      const state = 'test_state';
      const verifier = 'test_verifier';
      PkceHelper.storeCodeVerifier(state, verifier);
      expect(PkceHelper.verifierStore.get(state)).toBe(verifier);
    });

    it('should throw error if state is missing', () => {
      expect(() => {
        PkceHelper.storeCodeVerifier(null, 'test_verifier');
      }).toThrow('State and verifier are required');
    });

    it('should throw error if verifier is missing', () => {
      expect(() => {
        PkceHelper.storeCodeVerifier('test_state', null);
      }).toThrow('State and verifier are required');
    });

    it('should overwrite existing verifier for same state', () => {
      const state = 'test_state';
      PkceHelper.storeCodeVerifier(state, 'verifier1');
      PkceHelper.storeCodeVerifier(state, 'verifier2');
      expect(PkceHelper.verifierStore.get(state)).toBe('verifier2');
    });
  });

  describe('getCodeVerifier', () => {
    it('should retrieve stored verifier and remove it', () => {
      const state = 'test_state';
      const verifier = 'test_verifier';
      PkceHelper.storeCodeVerifier(state, verifier);
      
      const retrieved = PkceHelper.getCodeVerifier(state);
      expect(retrieved).toBe(verifier);
      
      // Verify it was removed
      expect(PkceHelper.verifierStore.has(state)).toBe(false);
    });

    it('should return null for non-existent state', () => {
      const retrieved = PkceHelper.getCodeVerifier('non_existent');
      expect(retrieved).toBeNull();
    });

    it('should handle undefined state parameter', () => {
      const retrieved = PkceHelper.getCodeVerifier(undefined);
      expect(retrieved).toBeNull();
    });
  });

  describe('end-to-end PKCE flow', () => {
    it('should work for a complete PKCE flow', () => {
      // Generate verifier and challenge
      const verifier = PkceHelper.generateCodeVerifier();
      const challenge = PkceHelper.generateCodeChallenge(verifier);
      
      // Store verifier with state
      const state = 'test_state';
      PkceHelper.storeCodeVerifier(state, verifier);
      
      // Retrieve verifier
      const retrieved = PkceHelper.getCodeVerifier(state);
      expect(retrieved).toBe(verifier);
      
      // Generate challenge from retrieved verifier
      const newChallenge = PkceHelper.generateCodeChallenge(retrieved);
      expect(newChallenge).toBe(challenge);
    });
  });
});
