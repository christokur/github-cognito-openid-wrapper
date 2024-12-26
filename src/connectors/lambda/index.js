// Enable source map support if enabled via environment variable
const sourceMapSupport = process.env.SOURCE_MAP_SUPPORT;
if (
  sourceMapSupport &&
  ['1', 'yes', 'true'].includes(sourceMapSupport.toLowerCase())
) {
  require('source-map-support').install();
}

const { VERSION } = require('./version');

const VERSION_CONSUMER = process.env.VERSION_CONSUMER || '0.0.0';
const VERSION_COMPONENT = process.env.VERSION_COMPONENT || '0.0.0';

const logger = require('../logger');
const authorize = require('./authorize');
const openIdConfiguration = require('./open-id-configuration');
const token = require('./token');
const userinfo = require('./userinfo');
const jwks = require('./jwks');
const favicon = require('../../favicon');
const processRequest = require('./process-request');
const { formatResponse } = require('./response-utils');
const versionHandler = require('./version-handler');

// Map endpoints to their validation schemas and handlers
const endpointConfig = {
  '/api/version': {
    schema: null, // No validation needed
    handler: versionHandler.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'no-store',
  },
  '/authorize': {
    schema: 'authorize',
    handler: authorize.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'no-store',
  },
  '/.well-known/openid-configuration': {
    schema: null, // No validation needed
    handler: openIdConfiguration.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400',
  },
  '/token': {
    schema: 'token',
    handler: token.handler,
    requiresRateLimit: true,
    allowedMethods: ['POST'],
    cacheControl: 'no-store',
  },
  '/userinfo': {
    schema: 'userinfo',
    handler: userinfo.handler,
    requiresRateLimit: true,
    requiresAuth: true,
    allowedMethods: ['GET', 'POST'],
    cacheControl: 'no-store',
  },
  '/.well-known/jwks.json': {
    schema: null, // No validation needed
    handler: jwks.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400',
  },
  '/favicon.ico': {
    schema: null, // No validation needed
    handler: favicon.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400',
  },
};

function handler(event, context, callback) {
  // Allow Lambda to wait for event loop to empty so logs are flushed
  context.callbackWaitsForEmptyEventLoop = true;

  // Log request details
  logger.info({
    message: 'Lambda invoked',
    version: VERSION,
    versionConsumer: VERSION_CONSUMER,
    versionComponent: VERSION_COMPONENT,
    path: event.path,
    remainingTime: context.getRemainingTimeInMillis(),
    method: event.httpMethod,
    event,
    context,
    memoryUsage: process.memoryUsage(),
  });

  // // Log detailed request info
  // logger.debug({
  //   message: 'Received request',
  //   path: event.path,
  //   httpMethod: event.httpMethod,
  //   headers: event.headers,
  //   queryStringParameters: event.queryStringParameters,
  //   body: event.body,
  //   isBase64Encoded: event.isBase64Encoded,
  //   requestId: context.awsRequestId,
  //   remainingTime: context.getRemainingTimeInMillis(),
  //   versions: {
  //     consumer: VERSION_CONSUMER,
  //     component: VERSION_COMPONENT,
  //     api: VERSION,
  //   },
  // });

  // Set a timeout handler
  const timeoutHandler = setTimeout(() => {
    logger.warn({
      message: 'Request timed out',
      path: event.path,
      requestId: context.awsRequestId,
      remainingTime: context.getRemainingTimeInMillis(),
    });
    return callback(
      null,
      formatResponse(
        {
          statusCode: 504,
          body: JSON.stringify({
            error: 'gateway_timeout',
            error_description: 'Request timed out',
          }),
        },
        { cacheControl: 'no-store', allowedMethods: ['GET'] },
      ),
    );
  }, Math.max(context.getRemainingTimeInMillis() - 1000, 0));

  // Check if path exists
  if (!event.path) {
    clearTimeout(timeoutHandler);
    return callback(
      null,
      formatResponse(
        {
          statusCode: 404,
          body: JSON.stringify({
            error: 'not_found',
            error_description: 'Endpoint not found',
          }),
        },
        { cacheControl: 'no-store', allowedMethods: ['GET'] },
      ),
    );
  }

  // Get endpoint configuration
  const config = endpointConfig[event.path];
  
  // Log after getting config to ensure it's captured
  logger.info({
    message: 'Looking up endpoint config',
    path: event.path || '',
    pathType: typeof event.path,
    pathLength: event.path ? event.path.length : 0,
    pathCharCodes: event.path
      ? Array.from(event.path).map((c) => c.charCodeAt(0))
      : [],
    availableEndpoints: Object.keys(endpointConfig),
    foundConfig: !!config,
    config
  });
  if (!config) {
    clearTimeout(timeoutHandler);
    return callback(
      null,
      formatResponse(
        {
          statusCode: 404,
          body: JSON.stringify({
            error: 'not_found',
            error_description: 'Endpoint not found',
          }),
        },
        { cacheControl: 'no-store', allowedMethods: ['GET'] },
      ),
    );
  }

  // Process request with endpoint-specific configuration
  processRequest(event, context, config)
    .then((response) => {
      clearTimeout(timeoutHandler);
      logger.debug({
        message: 'Sending response',
        response,
      });
      return callback(null, response);
    })
    .catch((error) => {
      clearTimeout(timeoutHandler);
      logger.error({
        message: 'Request processing failed',
        error: error.message,
        stack: error.stack,
        path: event.path,
        requestId: context.awsRequestId,
        remainingTime: context.getRemainingTimeInMillis(),
      });

      // Preserve original error details and status code
      const errorResponse = {
        error: error.type || 'server_error',
        error_description: error.message || 'Internal server error',
      };

      // Add debug info in development
      if (process.env.NODE_ENV === 'development') {
        errorResponse.debug = {
          stack: error.stack,
          requestId: context.awsRequestId,
          remainingTime: context.getRemainingTimeInMillis(),
          memoryUsage: process.memoryUsage(),
        };
      }

      // Create response with headers
      const response = {
        statusCode: error.statusCode || 500,
        body: JSON.stringify(errorResponse),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add retry-after header for rate limit errors
      if (error.retryAfter) {
        response.headers['Retry-After'] = error.retryAfter.toString();
      }

      return callback(
        null,
        formatResponse(response, {
          cacheControl: 'no-store',
          allowedMethods: ['GET'],
        }),
      );
    });
}

module.exports = {
  endpointConfig,
  handler,
};
