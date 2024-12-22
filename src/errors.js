const logger = require('./connectors/logger');

// Error types
const errorTypes = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  INVALID_SCOPE: 'invalid_scope',
  ACCESS_DENIED: 'access_denied',
  SERVER_ERROR: 'server_error'
};

// Error messages
const errorMessages = {
  [errorTypes.INVALID_REQUEST]: 'The request is missing a required parameter',
  [errorTypes.INVALID_CLIENT]: 'Client authentication failed',
  [errorTypes.INVALID_GRANT]: 'The provided authorization grant is invalid',
  [errorTypes.UNAUTHORIZED_CLIENT]: 'The client is not authorized',
  [errorTypes.UNSUPPORTED_GRANT_TYPE]: 'The authorization grant type is not supported',
  [errorTypes.INVALID_SCOPE]: 'The requested scope is invalid or malformed',
  [errorTypes.ACCESS_DENIED]: 'The resource owner denied the request',
  [errorTypes.SERVER_ERROR]: 'The server encountered an unexpected condition'
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
  [errorTypes.SERVER_ERROR]: 500
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
    error_description: error.message
  };

  logger.error({
    message: 'OAuth error',
    error: response,
    stack: error.stack
  });

  return response;
}

module.exports = {
  OAuthError,
  errorTypes,
  formatOAuthError
};
