const logger = require('./connectors/logger');
const UserInfoService = require('./services/userInfo');
const TokenService = require('./services/token');
const Configuration = require('./config');
const ConfigurationService = require('./services/configuration');
const AuthorizationService = require('./services/authorization');

/**
 * OpenID Connect provider implementation using GitHub as the backend
 */
class OpenIDProvider {
  /**
   * Gets user information in OpenID Connect format
   * @param {string} accessToken - GitHub access token
   */
  static async getUserInfo(accessToken) {
    return await UserInfoService.getUserInfo(accessToken);
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
  static async getAuthorizeUrl(client_id, scope, state, response_type, nonce) {
    return await AuthorizationService.getAuthorizeUrl({
      client_id,
      scope,
      state,
      response_type,
      nonce,
    });
  }

  /**
   * Processes token exchange
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} host - Host URL
   * @param {string} codeVerifier - PKCE code verifier
   * @param {string} client_id - OAuth client ID
   * @returns {Object} Token response
   */
  static async getTokens(code, state, host, codeVerifier, client_id) {
    if (!code) {
      throw new Error('The code parameter is required');
    }
    if (!client_id) {
      throw new Error('The client_id parameter is required');
    }
    logger.debug({
      message: 'Getting tokens',
      code,
      state,
      codeVerifier,
      host,
      client_id,
      memoryUsage: process.memoryUsage(),
    });

    const tokenResponse = await TokenService.processTokenExchange({
      code,
      state,
      host,
      codeVerifier,
      client_id,
    });

    logger.debug({
      message: 'processTokenExchange completed',
      memoryUsage: process.memoryUsage(),
      tokenResponse,
    });

    return tokenResponse;
  }
}

module.exports = {
  getTokens: OpenIDProvider.getTokens,
  getUserInfo: OpenIDProvider.getUserInfo,
  getJwks: OpenIDProvider.getJwks,
  getConfigFor: OpenIDProvider.getConfigFor,
  getAuthorizeUrl: OpenIDProvider.getAuthorizeUrl,
};
