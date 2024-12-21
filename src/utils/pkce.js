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
    const hash = crypto.createHash('sha256');
    hash.update(verifier);
    return base64url(hash.digest());
  }
}

module.exports = PkceHelper;
