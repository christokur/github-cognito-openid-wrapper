const base64url = require('base64url');
const crypto = require('crypto');

/**
 * PKCE (Proof Key for Code Exchange) helper functions
 */
class PkceHelper {
  static verifierStore = new Map();

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
    const hash = crypto.createHash('sha256');
    hash.update(verifier);
    return base64url(hash.digest());
  }

  /**
   * Stores a code verifier for a given state
   * @param {string} state - The state to associate with the verifier
   * @param {string} verifier - The code verifier to store
   */
  static storeCodeVerifier(state, verifier) {
    if (!state || !verifier) {
      throw new Error('State and verifier are required');
    }
    this.verifierStore.set(state, verifier);
  }

  /**
   * Retrieves and removes a stored code verifier
   * @param {string} state - The state to retrieve verifier for
   * @returns {string|null} The stored code verifier or null if not found
   */
  static getCodeVerifier(state) {
    const verifier = this.verifierStore.get(state);
    if (verifier) {
      this.verifierStore.delete(state);
    }
    return verifier || null;
  }
}

module.exports = PkceHelper;
