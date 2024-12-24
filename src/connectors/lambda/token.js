const qs = require('querystring');
const controllers = require('../controllers');
const { OAuthError, errorTypes } = require('../../errors');
const logger = require('../logger');
const { parseBody } = require('./request-utils');

module.exports.handler = async (event, context) => {
  try {
    const { body, contentType } = parseBody(event);

    logger.debug({
      message: 'Processing token request',
      body,
      contentType,
    });

    // Validate request body
    if (!body || typeof body !== 'object') {
      throw new OAuthError(
        errorTypes.INVALID_REQUEST,
        'Request body is required',
      );
    }

    // Validate host header first
    const host = event.headers && (event.headers.Host || event.headers.host);
    if (!host) {
      throw new OAuthError(
        errorTypes.INVALID_REQUEST,
        'Host header is required',
      );
    }

    // Validate required parameters
    const { code, state, code_verifier, client_id } = body;
    const requiredParams = ['code', 'client_id'];
    const missingParams = requiredParams.filter((param) => !body[param]);

    if (missingParams.length > 0) {
      throw new OAuthError(
        errorTypes.INVALID_REQUEST,
        `Missing required parameters: ${missingParams.join(', ')}`,
      );
    }

    logger.debug({
      message: 'Calling token controller',
      code,
      state,
      code_verifier,
      host,
    });

    const response = await controllers().token(
      code,
      state,
      host,
      code_verifier,
      client_id,
    );

    // Ensure error responses have correct status code
    if (response.body) {
      const responseBody = JSON.parse(response.body);
      if (responseBody.error === errorTypes.INVALID_REQUEST) {
        response.statusCode = 400;
      }
    }

    return response;
  } catch (error) {
    logger.error({
      message: 'Token handler error',
      error: error.message || error,
    });

    const errorResponse = {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      body: JSON.stringify({
        error: error.type || 'server_error',
        error_description: error.message || 'An unexpected error occurred',
      }),
    };
    logger.error({
      message: 'Returning error response to API Gateway',
      response: errorResponse,
    });
    return errorResponse;
  }
};
