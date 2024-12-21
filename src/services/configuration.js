const logger = require('../connectors/logger');
const Configuration = require('../config.js');

/**
 * Service for handling OpenID Connect configuration
 */
class ConfigurationService {
  /**
   * Normalizes host URL by ensuring it has HTTPS protocol
   * @param {string} host - Host URL
   * @returns {string} Normalized host URL
   */
  static normalizeHost(host) {
    logger.debug({
        message: 'Normalizing host URL',
        host
      });
    if (!host) {
      throw new Error('Host is required');
    }
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      return `https://${host}`;
    }
    return host;
  }

  /**
   * Gets OpenID Connect configuration for a host
   * @param {string} host - Host URL
   * @returns {Object} OpenID Connect configuration
   */
  static getConfiguration(host) {
    try {
      logger.debug({
        message: 'Getting OpenID configuration',
        host,
        memoryUsage: process.memoryUsage()
      });

      const normalizedHost = this.normalizeHost(host);

      const configuration = {
        issuer: normalizedHost,
        authorization_endpoint: `${normalizedHost}/authorize`,
        token_endpoint: `${normalizedHost}/token`,
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'private_key_jwt'
        ],
        token_endpoint_auth_signing_alg_values_supported: ['RS256'],
        userinfo_endpoint: `${normalizedHost}/userinfo`,
        jwks_uri: `${normalizedHost}/.well-known/jwks.json`,
        scopes_supported: ['openid', 'read:user', 'user:email'],
        response_types_supported: ['code', 'code id_token'],
        response_modes_supported: ['query', 'fragment'],
        grant_types_supported: ['authorization_code'],
        subject_types_supported: ['public'],
        userinfo_signing_alg_values_supported: ['none'],
        id_token_signing_alg_values_supported: ['RS256'],
        request_object_signing_alg_values_supported: ['none'],
        claims_supported: [
          'sub',
          'name',
          'preferred_username',
          'profile',
          'picture',
          'website',
          'email',
          'email_verified',
          'updated_at',
          'iss',
          'aud'
        ],
        code_challenge_methods_supported: ['plain', 'S256']
      };

      logger.debug({
        message: 'Retrieved OpenID configuration',
        configuration,
        memoryUsage: process.memoryUsage()
      });

      return configuration;
    } catch (error) {
      logger.error({
        message: 'Failed to get OpenID configuration',
        error: error.message || error,
        memoryUsage: process.memoryUsage()
      });
      throw error;
    }
  }

  /**
   * Validates required authorization parameters
   * @param {Object} params - Authorization parameters
   * @throws {Error} If any required parameter is missing
   */
  static validateAuthorizationParams({ client_id, scope, state, response_type, nonce }) {
    if (!client_id) throw new Error('client_id is required');
    if (!scope) throw new Error('scope is required');
    if (!state) throw new Error('state is required');
    if (!response_type) throw new Error('response_type is required');
    // if (!nonce) throw new Error('nonce is required');
  }
}

module.exports = ConfigurationService;
