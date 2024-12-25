const logger = require('./connectors/logger');

// OAuth2 error codes as defined in RFC 6749
const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  SERVER_ERROR: 'server_error',
  ACCESS_DENIED: 'access_denied',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
};

// Error types
const errorTypes = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  INVALID_SCOPE: 'invalid_scope',
  ACCESS_DENIED: 'access_denied',
  SERVER_ERROR: 'server_error',
};

// Error messages
const errorMessages = {
  [errorTypes.INVALID_REQUEST]: 'The request is missing a required parameter',
  [errorTypes.INVALID_CLIENT]: 'Client authentication failed',
  [errorTypes.INVALID_GRANT]: 'The provided authorization grant is invalid',
  [errorTypes.UNAUTHORIZED_CLIENT]: 'The client is not authorized',
  [errorTypes.UNSUPPORTED_GRANT_TYPE]:
    'The authorization grant type is not supported',
  [errorTypes.INVALID_SCOPE]: 'The requested scope is invalid or malformed',
  [errorTypes.ACCESS_DENIED]: 'The resource owner denied the request',
  [errorTypes.SERVER_ERROR]: 'The server encountered an unexpected condition',
};

// HTTP status codes
const statusCodes = {
  [errorTypes.INVALID_REQUEST]: 400,
  [errorTypes.INVALID_CLIENT]: 401,
  [errorTypes.INVALID_GRANT]: 400,
  [errorTypes.UNAUTHORIZED_CLIENT]: 403,
  [errorTypes.UNSUPPORTED_GRANT_TYPE]: 400,
  [errorTypes.INVALID_SCOPE]: 400,
  [errorTypes.ACCESS_DENIED]: 403,
  [errorTypes.SERVER_ERROR]: 500,
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
  if (error.message.includes('invalid token') || error.message.includes('GitHub API responded with 401')) {
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

class OAuthError extends Error {
  constructor(type, message) {
    super(message || errorMessages[type]);
    this.type = type;
    this.statusCode = statusCodes[type];
  }
}

// Helper function to format OAuth error response
function formatOAuthError(error) {
  const response = {
    error: error.type || 'server_error',
    error_description: error.message,
  };

  logger.error({
    message: 'OAuth error',
    error: response,
    stack: error.stack,
  });

  return response;
}

module.exports = {
  OAUTH_ERRORS,
  errorTypes,
  errorMessages,
  statusCodes,
  OAuthError,
  mapError,
  formatOAuthError,
};
