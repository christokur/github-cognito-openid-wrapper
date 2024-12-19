const logger = require('../connectors/logger');
const githubClient = require('../github');
const Configuration = require('../config');
const PkceHelper = require('../utils/pkce');
const ConfigurationService = require('./configuration');

/**
 * Service for handling authorization flow
 */
class AuthorizationService {
  /**
   * Stores authorization state in a secure way
   * @param {string} codeVerifier - PKCE code verifier
   * @param {string} nonce - Authorization nonce
   * @private
   */
  static storeAuthState(codeVerifier, nonce) {
    // In production, this should use a secure session store
    // For now, using environment variables as per original implementation
    process.env.CODE_VERIFIER = codeVerifier;
    process.env.NONCE = nonce;
  }

  /**
   * Retrieves and clears stored authorization state
   * @returns {Object} Stored authorization state
   * @private
   */
  static getAndClearAuthState() {
    const state = {
      codeVerifier: process.env.CODE_VERIFIER,
      nonce: process.env.NONCE
    };

    // Clear sensitive data
    delete process.env.CODE_VERIFIER;
    delete process.env.NONCE;

    return state;
  }

  /**
   * Generates authorization URL with PKCE
   * @param {Object} params - Authorization parameters
   * @returns {string} Authorization URL
   */
  static getAuthorizeUrl({ client_id, scope, state, response_type, nonce }) {
    try {
      logger.debug({
        message: 'Generating authorize URL',
        client_id,
        scope,
        state,
        response_type,
        nonce,
        memoryUsage: process.memoryUsage()
      });

      // Validate required parameters
      ConfigurationService.validateAuthorizationParams({
        client_id,
        scope,
        state,
        response_type,
        nonce
      });

      // Generate PKCE values
      const codeVerifier = PkceHelper.generateCodeVerifier();
      const codeChallenge = PkceHelper.generateCodeChallenge(codeVerifier);

      // Get authorization URL from GitHub client
      const url = githubClient(Configuration.GITHUB_API_URL, Configuration.GITHUB_LOGIN_URL)
        .getAuthorizeUrl(client_id, scope, state, response_type, nonce, codeChallenge);

      // Store PKCE and nonce values
      this.storeAuthState(codeVerifier, nonce);

      logger.debug({
        message: 'Generated authorize URL',
        url,
        memoryUsage: process.memoryUsage()
      });

      return url;
    } catch (error) {
      logger.error({
        message: 'Failed to generate authorize URL',
        error: error.message || error,
        memoryUsage: process.memoryUsage()
      });
      throw error;
    }
  }

  /**
   * Retrieves stored authorization state
   * @returns {Object} Authorization state
   */
  static getStoredState() {
    return this.getAndClearAuthState();
  }
}

module.exports = AuthorizationService;
