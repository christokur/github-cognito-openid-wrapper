const logger = require('./connectors/logger');
const UserInfoService = require('./services/userInfo');
const TokenService = require('./services/token');
const ConfigurationService = require('./services/configuration');
const AuthorizationService = require('./services/authorization');

/**
 * OpenID Connect provider implementation using GitHub as the backend
 */
class OpenIDProvider {
  /**
   * Gets user information in OpenID Connect format
   * @param {string} accessToken - GitHub access token
   * @returns {Promise<Object>} User information as OpenID claims
   */
  static getUserInfo(accessToken) {
    return UserInfoService.getUserInfo(accessToken);
  }

  /**
   * Gets JSON Web Key Set
   * @returns {Object} JWKS containing public keys
   */
  static getJwks() {
    return TokenService.getJwks();
  }

  /**
   * Gets OpenID Connect configuration
   * @param {string} host - Host URL
   * @returns {Object} OpenID Connect configuration
   */
  static getConfigFor(host) {
    return ConfigurationService.getConfiguration(host);
  }

  /**
   * Gets authorization URL
   * @param {string} client_id - OAuth client ID
   * @param {string} scope - OAuth scopes
   * @param {string} state - State parameter
   * @param {string} response_type - Response type (e.g., 'code')
   * @param {string} nonce - Nonce value for security
   * @returns {string} Authorization URL
   */
  static getAuthorizeUrl(client_id, scope, state, response_type, nonce) {
    return AuthorizationService.getAuthorizeUrl({
      client_id,
      scope,
      state,
      response_type,
      nonce
    });
  }

  /**
   * Processes token exchange
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} host - Host URL
   * @param {string} nonce - Nonce value
   * @returns {Promise<Object>} Token response
   */
  static async getTokens(code, state, host, nonce) {
    try {
      logger.debug({
        message: 'Getting tokens',
        code,
        state,
        host,
        nonce,
        memoryUsage: process.memoryUsage()
      });

      const { codeVerifier, nonce: storedNonce } = AuthorizationService.getStoredState();

      if (!codeVerifier) {
        throw new Error('Code verifier not found');
      }

      const tokenResponse = await TokenService.processTokenExchange({
        code,
        state,
        host,
        nonce,
        storedNonce,
        codeVerifier
      });

      logger.debug({
        message: 'Token exchange completed',
        memoryUsage: process.memoryUsage()
      });

      return tokenResponse;
    } catch (error) {
      logger.error({
        message: 'Failed in token exchange',
        error: error.message || error,
        memoryUsage: process.memoryUsage()
      });
      throw error;
    }
  }
}

module.exports = {
  getTokens: OpenIDProvider.getTokens,
  getUserInfo: OpenIDProvider.getUserInfo,
  getJwks: OpenIDProvider.getJwks,
  getConfigFor: OpenIDProvider.getConfigFor,
  getAuthorizeUrl: OpenIDProvider.getAuthorizeUrl
};
