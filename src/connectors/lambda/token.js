const qs = require('querystring');
const responder = require('./util/responder');
const controllers = require('../controllers');
const { validators, handleError } = require('./util/error-handler');
const logger = require('../logger');

const parseBody = (event) => {
  logger.debug({
    message: 'Token handler received event',
    event
  });
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  
  if (event.body) {
    if (contentType && contentType.startsWith('application/x-www-form-urlencoded')) {
      const parsedBody = qs.parse(event.body);
      logger.debug({
        message: 'Parsed x-www-form-urlencoded data',
        contentType,
        parsedBody
      });
      return parsedBody;
    }
    if (contentType && contentType.startsWith('application/json')) {
      const parsedBody = JSON.parse(event.body);
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

module.exports.handler = (event, context, callback) => {
  try {
    const body = parseBody(event);
    logger.debug({
      message: 'Validating code from body',
      body
    });
    const code = validators.required(body.code, 'code');
    const state = body.state ? validators.state(body.state) : undefined;
    const codeVerifier = validators.required(body.code_verifier, 'code_verifier');
    const host = event.headers.Host;

    logger.debug({
      message: 'Calling token controller',
      code,
      state,
      codeVerifier,
      host
    });

    return controllers().token(code, state, host, codeVerifier);
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
