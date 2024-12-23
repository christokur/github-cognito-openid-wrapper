const logger = require('../../logger');
const { OAuthError, errorTypes, formatOAuthError } = require('../../../errors');
const { ValidationError } = require('../../../utils/validator');

function handleError(error, callback) {
  let oauthError;

  if (error instanceof ValidationError) {
    oauthError = new OAuthError(
      errorTypes.INVALID_REQUEST,
      `${error.field} ${error.message}`,
    );
  } else if (error instanceof OAuthError) {
    oauthError = error;
  } else {
    logger.error('Unexpected error:', error);
    oauthError = new OAuthError(
      errorTypes.SERVER_ERROR,
      'An unexpected error occurred',
    );
  }

  const response = {
    statusCode: oauthError.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(formatOAuthError(oauthError)),
  };

  logger.error({
    message: 'Error handling request',
    error: error.message,
    stack: error.stack,
    response,
  });

  callback(null, response);
}

module.exports = {
  OAuthError,
  errorTypes,
  handleError,
};
