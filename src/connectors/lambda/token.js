const qs = require('querystring');
const responder = require('./util/responder');
const controllers = require('../controllers');
const { handleError } = require('./util/error-handler');
const { OAuthError, errorTypes } = require('../../errors');
const { validate, schemas } = require('../../utils/validator');
const logger = require('../logger');

const parseBody = (event) => {
  logger.debug({
    message: 'Token handler received event',
    event
  });
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];

  if (event.body) {
    if (contentType && contentType.startsWith('application/x-www-form-urlencoded')) {
      const parsedBody = typeof event.body === 'string' ? qs.parse(event.body) : event.body;
      logger.debug({
        message: 'Parsed x-www-form-urlencoded data',
        contentType,
        parsedBody
      });
      return parsedBody;
    }
    if (contentType && contentType.startsWith('application/json')) {
      const parsedBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      logger.debug({
        message: 'Parsed JSON body',
        contentType,
        parsedBody
      });
      return parsedBody;
    }
  }
  logger.debug({
    message: 'No parseable body found in request'
  });
  return {};
};

module.exports.handler = (event, context) => {
  try {
    const body = parseBody(event);
    logger.debug({
      message: 'Validating code from body',
      body
    });

    // Validate request using schema
    const validatedData = validate('token', body);
    const { code, state, code_verifier } = validatedData;
    const host = event.headers.Host || event.headers.host;

    if (!host) {
      throw new OAuthError(errorTypes.INVALID_REQUEST, 'Host header is required');
    }

    logger.debug({
      message: 'Calling token controller',
      code,
      state,
      code_verifier,
      host
    });

    return controllers().token(code, state, host, code_verifier);
  } catch (error) {
    logger.error({
      message: 'Token handler error',
      error: error.message || error
    });
    const errorResponse = {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        error: error.type || 'server_error',
        error_description: error.message || 'An unexpected error occurred'
      })
    };
    logger.error({
      message: 'Returning error response to API Gateway',
      response: errorResponse
    });
    return errorResponse;
  }
};
