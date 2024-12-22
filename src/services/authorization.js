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
   * Generates authorization URL with PKCE
   * @param {Object} params - Authorization parameters
   * @returns {string} Authorization URL
   */
  static getAuthorizeUrl({ client_id, scope, state, response_type, nonce }) {
    try {
      // Validate parameters
      ConfigurationService.validateAuthorizationParams({
        client_id,
        scope,
        state,
        response_type,
        nonce
      });

      const githubClientInstance = githubClient(
        Configuration.GITHUB_API_URL,
        Configuration.GITHUB_LOGIN_URL
      );

      // Generate PKCE values
      const codeVerifier = PkceHelper.generateCodeVerifier();
      const codeChallenge = PkceHelper.generateCodeChallenge(codeVerifier);

      logger.debug({
        message: 'Generating authorize URL',
        client_id,
        scope,
        state,
        response_type,
        nonce,
        codeChallenge
      });

      return githubClientInstance.getAuthorizeUrl(
        client_id,
        scope,
        state,
        response_type,
        nonce,
        codeChallenge
      );
    } catch (error) {
      logger.error({
        message: 'Failed to generate authorize URL',
        error: error.message || error
      });
      throw error;
    }
  }
}

module.exports = AuthorizationService;
