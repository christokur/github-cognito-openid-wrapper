const qs = require('querystring');
const responder = require('./util/responder');
const controllers = require('../controllers');
const { OAuthError, errorTypes } = require('../../errors');
const logger = require('../logger');

module.exports.handler = (event, context) => {
  try {
    const {body} = event;
    logger.debug({
      message: 'Processing token request',
      body
    });

    // Check content type
    const contentType = event.headers['Content-Type'] || event.headers['content-type'];
    if (contentType !== 'application/json') {
      throw new OAuthError(errorTypes.INVALID_REQUEST, 'Content-Type must be application/json');
    }

    // Validate required fields
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      throw new OAuthError(errorTypes.INVALID_REQUEST, 'Request body is required');
    }

    const { code, state, code_verifier } = body;
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
      statusCode: error.statusCode || (error.type === errorTypes.INVALID_REQUEST ? 400 : 500),
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
