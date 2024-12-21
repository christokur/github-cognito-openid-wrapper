const logger = require('../../logger');

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

// Input validation functions
const validators = {
  required: (value, name) => {
    if (!value) {
      throw new OAuthError(errorTypes.INVALID_REQUEST, `${name} is required`);
    }
    return value;
  },
  scope: (value) => {
    if (!value) return value;
    
    // URL decode the scope string
    const decodedValue = decodeURIComponent(value.replace(/\+/g, ' '));
    
    // Split into individual scopes and validate each one
    const scopes = decodedValue.split(' ');
    const validScopeRegex = /^[\w.:-]+$/;
    
    if (!scopes.every(scope => validScopeRegex.test(scope))) {
      throw new OAuthError(errorTypes.INVALID_SCOPE, `scope contains invalid characters: ${  decodedValue}`);
    }
    
    return value;
  },
  state: (value) => {
    if (value && !value.match(/^[A-Za-z0-9-._~+/]+=*$/)) {
      throw new OAuthError(errorTypes.INVALID_REQUEST, `state contains invalid characters: ${  value}`);
    }
    return value;
  },
  response_type: (value) => {
    if (value && !['code', 'token'].includes(value)) {
      throw new OAuthError(errorTypes.INVALID_REQUEST, 'response_type must be code or token');
    }
    return value;
  },
} ;

class OAuthError extends Error {
  constructor(type, message) {
    super(message || errorMessages[type]);
    this.type = type;
    this.statusCode = statusCodes[type];
  }
}

function handleError(error, callback) {
  let response;

  if (error instanceof OAuthError) {
    response = {
      statusCode: error.statusCode,
      body: JSON.stringify({
        error: error.type,
        error_description: error.message
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      }
    };
  } else {
    logger.error('Unexpected error:', error);
    response = {
      statusCode: 500,
      body: JSON.stringify({
        error: errorTypes.SERVER_ERROR,
        error_description: 'An unexpected error occurred'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      }
    };
  }

  callback(null, response);
}

module.exports = {
  OAuthError,
  errorTypes,
  handleError,
  validators
};
