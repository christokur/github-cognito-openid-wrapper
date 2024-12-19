const logger = require('../connectors/logger');
const crypto = require('../crypto');
const githubClient = require('../github');
const Configuration = require('../config');

/**
 * Service for handling token operations
 */
class TokenService {
  /**
   * Validates the nonce value
   * @param {string} storedNonce - The original nonce stored during authorization
   * @param {string} receivedNonce - The nonce received in the callback
   * @throws {Error} If nonce is missing or invalid
   */
  static validateNonce(storedNonce, receivedNonce) {
    if (!storedNonce || !receivedNonce) {
      throw new Error('Nonce is required');
    }
    if (storedNonce !== receivedNonce) {
      throw new Error('Invalid nonce');
    }
  }

  /**
   * Retrieves JWKS (JSON Web Key Set)
   * @returns {Object} Object containing public keys
   */
  static getJwks() {
    try {
      logger.debug({
        message: 'Getting JWKS',
        memoryUsage: process.memoryUsage()
      });

      const keys = [crypto.getPublicKey()];

      logger.debug({
        message: 'Retrieved JWKS',
        keyCount: keys.length,
        memoryUsage: process.memoryUsage()
      });

      return { keys };
    } catch (error) {
      logger.error({
        message: 'Failed to get JWKS',
        error: error.message || error,
        memoryUsage: process.memoryUsage()
      });
      throw error;
    }
  }

  /**
   * Exchanges code for tokens
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} codeVerifier - PKCE code verifier
   */
  static async getGithubToken(code, state, codeVerifier) {
    try {
      const githubClientInstance = githubClient(
        Configuration.GITHUB_API_URL,
        Configuration.GITHUB_LOGIN_URL
      );

      const githubToken = await githubClientInstance.getToken(code, state, codeVerifier);

      // GitHub returns scopes separated by commas
      // But OAuth wants them to be spaces
      // https://tools.ietf.org/html/rfc6749#section-5.1
      // Also, we need to add openid as a scope,
      // since GitHub will have stripped it
      const scope = `openid ${githubToken.scope.replace(/,/g, ' ')}`;

      return {
        ...githubToken,
        scope
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get GitHub token',
        error: error.message || error
      });
      throw error;
    }
  }

  /**
   * Creates ID token
   * @param {Object} payload - Token payload
   * @param {string} host - Issuer host
   * @returns {string} Signed ID token
   */
  static createIdToken(payload, host) {
    try {
      logger.debug({
        message: 'Creating ID token with payload',
        payload
      });

      return crypto.makeIdToken(payload, host);
    } catch (error) {
      logger.error({
        message: 'Failed to create ID token',
        error: error.message || error
      });
      throw error;
    }
  }

  /**
   * Processes token exchange and creates response
   * @param {Object} params - Token exchange parameters
   */
  static async processTokenExchange({ code, state, host, nonce, storedNonce, codeVerifier }) {
    try {
      // Validate nonce
      this.validateNonce(storedNonce, nonce);

      // Get GitHub token
      const githubToken = await this.getGithubToken(code, state, codeVerifier);

      // Create ID token
      const payload = { nonce };
      const idToken = this.createIdToken(payload, host);

      return {
        ...githubToken,
        id_token: idToken
      };
    } catch (error) {
      logger.error({
        message: 'Failed to process token exchange',
        error: error.message || error
      });
      throw error;
    }
  }
}

module.exports = TokenService;
