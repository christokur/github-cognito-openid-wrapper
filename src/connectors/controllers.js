const logger = require('./logger');
const openid = require('../openid');
const { validate } = require('../utils/validator');

// OAuth2 error codes
const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  SERVER_ERROR: 'server_error',
};

// Map internal errors to OAuth2 errors
const mapError = (error) => {
  if (error.name === 'ValidationError') {
    return {
      code: OAUTH_ERRORS.INVALID_REQUEST,
      status: 400,
      message: error.message,
      errors: error.errors,
    };
  }
  if (error.message.includes('required parameter')) {
    return {
      code: OAUTH_ERRORS.INVALID_REQUEST,
      status: 400,
    };
  }
  if (error.message.includes('invalid token')) {
    return {
      code: OAUTH_ERRORS.INVALID_GRANT,
      status: 401,
    };
  }
  if (error.message.includes('rate limit')) {
    return {
      code: OAUTH_ERRORS.SERVER_ERROR,
      status: 429,
      headers: {
        'Retry-After': '60',
      },
    };
  }
  if (error.type && error.statusCode) {
    return {
      code: error.type,
      status: error.statusCode,
    };
  }
  return {
    code: OAUTH_ERRORS.SERVER_ERROR,
    status: 500,
  };
};

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
        error: error.message || error,
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
        error: error.message || error,
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

  token: async (code, state, host, codeVerifier) => {
    try {
      logger.debug({
        message: 'Token controller called',
        code,
        state,
        host,
        codeVerifier,
      });

      // Validate and sanitize input
      const validated = validate('token', {
        code,
        state,
        host,
        code_verifier: codeVerifier,
      });

      const tokens = await openid.getTokens(
        validated.code,
        validated.state,
        host,
        validated.code_verifier,
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
        error: error.message || error,
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
        error: error.message || error,
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
          ...(errors && { validation_errors: errors }),
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
        error: error.message || error,
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
          ...(errors && { validation_errors: errors }),
        }),
      };
    }
  },
});
