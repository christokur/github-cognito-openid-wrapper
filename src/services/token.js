const logger = require('../connectors/logger');
const crypto = require('../crypto');
const githubClient = require('../github');
const Configuration = require('../config');
const AuthorizationService = require('./authorization');
const { OAuthError, errorTypes } = require('../errors');

/**
 * Service for handling token operations
 */
class TokenService {
  /**
   * Retrieves JWKS (JSON Web Key Set)
   * @returns {Object} Object containing public keys
   */
  static getJwks() {
    try {
      logger.debug({
        message: 'Getting JWKS',
        memoryUsage: process.memoryUsage(),
      });

      const keys = [crypto.getPublicKey()];

      logger.debug({
        message: 'Retrieved JWKS',
        keyCount: keys.length,
        memoryUsage: process.memoryUsage(),
      });

      return { keys };
    } catch (error) {
      logger.error({
        message: 'Failed to get JWKS',
        error: error.message || error,
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
        Configuration.GITHUB_LOGIN_URL,
      );

      logger.debug({
        message: 'Getting GitHub token',
        code,
        state,
        codeVerifier,
      });

      const githubTokenResponse = await githubClientInstance.getToken(
        code,
        codeVerifier,
      );

      logger.debug({
        message: 'Got GitHub response',
        githubTokenResponse,
      });

      // GitHub returns scopes separated by commas
      // But OAuth wants them to be spaces
      // https://tools.ietf.org/html/rfc6749#section-5.1
      // Also, we need to add openid as a scope,
      // since GitHub will have stripped it
      const scope = `openid ${githubTokenResponse.scope.replace(/,/g, ' ')}`;

      return {
        ...githubTokenResponse,
        scope,
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get Github token',
        error: error.message || error,
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
  static async createIdToken(payload, host, aud) {
    try {
      logger.debug({
        message: 'Creating ID token with payload',
        payload,
      });

      return crypto.makeIdToken(payload, host, aud);
    } catch (error) {
      logger.error({
        message: 'Failed to create ID token',
        error: error.message || error,
      });
      throw error;
    }
  }

  /**
   * Process token exchange
   * @param {Object} params - Token exchange parameters
   * @param {string} params.code - Authorization code
   * @param {string} params.state - State parameter
   * @param {string} params.host - Host URL
   * @param {string} params.codeVerifier - PKCE code verifier
   * @param {string} [params.nonce] - Optional nonce for ID token
   */
  static async processTokenExchange({
    code,
    state,
    host,
    codeVerifier,
    nonce = null,
    client_id,
  }) {
    logger.debug({
      message: 'Processing token exchange',
      code,
      state,
      codeVerifier: codeVerifier ? '[REDACTED]' : undefined,
      host,
      memoryUsage: process.memoryUsage(),
    });

    try {
      // Get the GitHub token
      const githubToken = await this.getGithubToken(code, state, codeVerifier);
      logger.debug({
        message: 'Got GitHub token',
        githubToken,
      });

      // Get user info from GitHub
      const githubClientInstance = githubClient(
        Configuration.GITHUB_API_URL,
        Configuration.GITHUB_LOGIN_URL,
      );
      const userInfo = await githubClientInstance.getUserInfo(
        githubToken.access_token,
      );

      // Create ID token
      const payload = {
        ...userInfo,
        ...(nonce ? { nonce } : {}),
      };
      const idToken = await this.createIdToken(payload, host, client_id);

      // Format response for Cognito IdP
      const response = {
        access_token: idToken, // Use ID token as access token for Cognito
        token_type: 'Bearer',
        expires_in: 3600, // Standard 1 hour expiration
        id_token: idToken,
      };

      return response;
    } catch (error) {
      logger.error({
        message: 'Failed to process token exchange',
        error: error.message || error,
      });
      throw error;
    }
  }
}

module.exports = TokenService;
