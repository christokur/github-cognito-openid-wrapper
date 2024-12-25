const logger = require('./logger');
const openid = require('../openid');
const { validate } = require('../utils/validator');
const { OAUTH_ERRORS, mapError } = require('../errors');

module.exports = () => ({
  authorize: async (client_id, scope, state, response_type) => {
    try {
      // Validate and sanitize input
      const validated = validate('authorize', {
        client_id,
        scope,
        state,
        response_type,
      });

      const authorizeUrl = await openid.getAuthorizeUrl(
        validated.client_id,
        validated.scope,
        validated.state,
        validated.response_type,
      );

      logger.info({
        message: 'Redirecting to authorizeUrl',
      });
      logger.debug({
        message: 'Authorize URL generated',
        authorizeUrl,
      });

      return {
        statusCode: 302,
        headers: {
          Location: authorizeUrl,
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      };
    } catch (error) {
      logger.error({
        message: 'Failed to generate authorize URL',
        error,
      });
      const { code, status, headers = {}, message, errors } = mapError(error);
      return {
        statusCode: status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          ...headers,
        },
        body: JSON.stringify({
          error: code,
          error_description: message || error.message,
          ...(errors && { validation_errors: errors }),
        }),
      };
    }
  },

  userinfo: async (token) => {
    try {
      // Validate and sanitize input
      const validated = validate('userinfo', {
        access_token: token,
      });

      const userInfo = await openid.getUserInfo(validated.access_token);
      logger.debug({
        message: 'Resolved user infos',
        userInfo,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(userInfo),
      };
    } catch (error) {
      logger.error({
        message: 'Failed to provide user info',
        error,
      });
      const { code, status, headers = {}, message, errors } = mapError(error);
      return {
        statusCode: status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          ...headers,
        },
        body: JSON.stringify({
          error: code,
          error_description: message || error.message,
          ...errors,
        }),
      };
    }
  },

  token: async (code, state, host, codeVerifier, client_id) => {
    try {
      logger.debug({
        message: 'Token controller called',
        code,
        state,
        host,
        codeVerifier,
        client_id,
      });

      // Validate and sanitize input
      const validated = validate('token', {
        code,
        state,
        host,
        code_verifier: codeVerifier,
        client_id,
      });

      const tokens = await openid.getTokens(
        validated.code,
        validated.state,
        host,
        validated.code_verifier,
        validated.client_id,
      );
      logger.debug({
        message: 'Tokens retrieved',
        tokens,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(tokens),
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get tokens',
        error,
      });
      const { code, status, headers = {}, message, errors } = mapError(error);
      return {
        statusCode: status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          ...headers,
        },
        body: JSON.stringify({
          error: code,
          error_description: message || error.message,
          ...errors,
        }),
      };
    }
  },

  jwks: async () => {
    try {
      const keys = await openid.getJwks();
      logger.debug({
        message: 'JWKS retrieved',
        keys,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
        },
        body: JSON.stringify(keys),
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get JWKS',
        error,
      });
      const { code, status, headers = {}, message, errors } = mapError(error);
      return {
        statusCode: status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...headers,
        },
        body: JSON.stringify({
          error: code,
          error_description: message || error.message,
          ...errors,
        }),
      };
    }
  },

  openIdConfiguration: async (host) => {
    try {
      const config = await openid.getConfigFor(host);
      logger.debug({
        message: 'OpenID configuration retrieved',
        config,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
        },
        body: JSON.stringify(config),
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get OpenID configuration',
        error,
      });
      const { code, status, headers = {}, message, errors } = mapError(error);
      return {
        statusCode: status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...headers,
        },
        body: JSON.stringify({
          error: code,
          error_description: message || error.message,
          ...errors,
        }),
      };
    }
  },
});
