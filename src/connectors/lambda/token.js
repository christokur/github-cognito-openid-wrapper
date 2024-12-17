const qs = require('querystring');
const responder = require('./util/responder');
const controllers = require('../controllers');
const { validators, handleError } = require('./util/error-handler');
const logger = require('../logger');

const parseBody = (event) => {
  logger.debug('Token handler received event: %j', event, {});
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  
  if (event.body) {
    if (contentType && contentType.startsWith('application/x-www-form-urlencoded')) {
      const parsedBody = qs.parse(event.body);
      logger.debug({
        contentType,
        parsedBody
      }, 'Parsed x-www-form-urlencoded data');
      return parsedBody;
    }
    if (contentType && contentType.startsWith('application/json')) {
      const parsedBody = JSON.parse(event.body);
      logger.debug({
        contentType,
        parsedBody
      }, 'Parsed JSON body: %j');
      return parsedBody;
    }
  }
  logger.debug('No parseable body found in request', {});
  return {};
};

module.exports.handler = (event, context, callback) => {
  try {
    const body = parseBody(event);
    logger.debug('Attempting to validate code from body', body);
    const code = validators.required(body.code, 'code');
    const state = body.state ? validators.state(body.state) : undefined;
    const host = event.headers.Host;

    logger.debug('Calling token controller with code: %s, state: %s, host: %s', code, state, host, {});
    
    const responseCallback = (error, response) => {
      if (error) {
        logger.error('Token controller error:', error);
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
        logger.error('Returning error response to API Gateway: %j', errorResponse, {});
        callback(null, errorResponse);
      } else {
        const successResponse = {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(response)
        };
        logger.debug('Returning success response to API Gateway: %j', successResponse, {});
        callback(null, successResponse);
      }
    };

    controllers(responder(responseCallback)).token(code, state, host);
  } catch (error) {
    logger.error('Token handler error: %s', error.message || error, {});
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
    logger.error('Returning error response to API Gateway: %j', errorResponse, {});
    callback(null, errorResponse);
  }
};
