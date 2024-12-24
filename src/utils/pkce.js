const base64url = require('base64url');
const crypto = require('crypto');

/**
 * PKCE (Proof Key for Code Exchange) helper functions
 */
class PkceHelper {
  /**
   * Generates a code verifier for PKCE
   * @returns {string} Base64URL-encoded random bytes
   */
  static generateCodeVerifier() {
    return base64url(crypto.randomBytes(32));
  }

  /**
   * Generates a code challenge from a verifier
   * @param {string} verifier - The code verifier to generate challenge from
   * @returns {string} Base64URL-encoded SHA256 hash of verifier
   */
  static generateCodeChallenge(verifier) {
    if (!verifier) {
      throw new Error('Verifier is required');
    }
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return base64url(hash);
  }

  /**
   * Stores a code verifier for a given state
   * @param {string} state - The state to store verifier for
   * @param {string} verifier - The code verifier to store
   */
  static storeCodeVerifier(state, verifier) {
    if (!state || !verifier) {
      throw new Error('State and verifier are required');
    }
    PkceHelper._getVerifierStore().set(state, verifier);
  }

  /**
   * Gets and removes a stored code verifier for a given state
   * @param {string} state - The state to get verifier for
   * @returns {string|null} The stored code verifier or null if not found
   */
  static getCodeVerifier(state) {
    const verifier = PkceHelper._getVerifierStore().get(state);
    if (verifier) {
      PkceHelper._getVerifierStore().delete(state);
    }
    return verifier || null;
  }

  /**
   * Gets the verifier store singleton
   * @private
   * @returns {Map} The verifier store
   */
  static _getVerifierStore() {
    if (!PkceHelper._verifierStore) {
      PkceHelper._verifierStore = new Map();
    }
    return PkceHelper._verifierStore;
  }
}

module.exports = PkceHelper;
