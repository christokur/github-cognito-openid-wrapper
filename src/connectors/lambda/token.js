const qs = require('querystring');
const responder = require('./util/responder');
const controllers = require('../controllers');
const { validators, handleError } = require('./util/error-handler');
const logger = require('../logger');

const parseBody = (event) => {
  logger.debug('Token handler received event: %j', event, {});
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  logger.debug('Content-Type header: %s', contentType, {});
  
  if (event.body) {
    if (contentType && contentType.startsWith('application/x-www-form-urlencoded')) {
      const parsedBody = qs.parse(event.body);
      logger.debug('Parsed form body: %j', parsedBody, {});
      return parsedBody;
    }
    if (contentType && contentType.startsWith('application/json')) {
      const parsedBody = JSON.parse(event.body);
      logger.debug('Parsed JSON body: %j', parsedBody, {});
      return parsedBody;
    }
  }
  logger.debug('No parseable body found in request', {});
  return {};
};

module.exports.handler = (event, context, callback) => {
  try {
    const body = parseBody(event);
    logger.debug('Attempting to validate code from body', {});
    const code = validators.required(body.code, 'code');
    const state = body.state ? validators.state(body.state) : undefined;
    const host = event.headers.Host;

    logger.debug('Calling token controller with code: %s, state: %s, host: %s', code, state, host, {});
    
    const responseCallback = (error, response) => {
      if (error) {
        logger.error('Token controller error:', error);
        callback(null, {
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
        });
      } else {
        callback(null, {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(response)
        });
      }
    };

    controllers(responder(responseCallback)).token(code, state, host);
  } catch (error) {
    logger.error('Token handler error: %s', error.message || error, {});
    callback(null, {
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
    });
  }
};
