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
        error: error.message || error
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
  static getGithubToken(code, state, codeVerifier) {
    try {
      const githubClientInstance = githubClient(
        Configuration.GITHUB_API_URL,
        Configuration.GITHUB_LOGIN_URL
      );

      logger.debug({
        message: 'Getting GitHub token',
        code,
        state,
        codeVerifier: codeVerifier ? '[REDACTED]' : undefined,
        memoryUsage: process.memoryUsage()
      });

      // Return a new promise that wraps the GitHub token call
      return githubClientInstance.getToken(code, codeVerifier).then(githubTokenResponse => {
        // GitHub returns scopes separated by commas
        // But OAuth wants them to be spaces
        // https://tools.ietf.org/html/rfc6749#section-5.1
        // Also, we need to add openid as a scope,
        // since GitHub will have stripped it
        const scope = `openid ${githubTokenResponse.scope.replace(/,/g, ' ')}`;

        return {
          ...githubTokenResponse,
          scope
        };
      });
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
   * Process token exchange
   * @param {Object} params - Token exchange parameters
   * @param {string} params.code - Authorization code
   * @param {string} params.state - State parameter
   * @param {string} params.host - Host URL
   * @param {string} params.codeVerifier - PKCE code verifier
   * @param {string} [params.nonce] - Optional nonce for ID token
   */
  static processTokenExchange({ code, state, host, codeVerifier, nonce = null }) {
    logger.debug({
      message: 'Starting token exchange process',
      code,
      state,
      host,
      codeVerifier,
      nonce
    });

    return this.getGithubToken(code, state, codeVerifier)
      .then(githubToken => {
        logger.debug({
          message: 'Received GitHub token',
          githubToken
        });

        const githubClientInstance = githubClient(
          Configuration.GITHUB_API_URL,
          Configuration.GITHUB_LOGIN_URL
        );

        return Promise.all([
          Promise.resolve(githubToken),
          githubClientInstance.getUserDetails(githubToken.access_token),
          githubClientInstance.getUserEmails(githubToken.access_token)
        ]);
      })
      .then(([githubToken, userInfo, userEmails]) => {
        const primaryEmail = userEmails.find(email => email.primary) || userEmails[0];

        // Create ID token payload with user info
        const payload = {
          sub: userInfo.id.toString(),
          name: userInfo.name,
          preferred_username: userInfo.login,
          email: primaryEmail.email,
          email_verified: primaryEmail.verified,
          ...(nonce ? { nonce } : {})
        };

        logger.debug({
          message: 'Creating ID token with user info',
          payload
        });

        // Create ID token
        const idToken = this.createIdToken(payload, host);
        logger.debug({
          message: 'Created ID token',
          idToken
        });

        const response = {
          ...githubToken,
          id_token: idToken
        };

        logger.debug({
          message: 'Token exchange complete',
          response
        });

        return response;
      })
      .catch(error => {
        logger.error({
          message: 'Failed to process token exchange',
          error: error.message || error
        });
        throw new OAuthError(errorTypes.SERVER_ERROR, error.message);
      });
  }
}

module.exports = TokenService;
