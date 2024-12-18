// Enable source map support if enabled via environment variable
const sourceMapSupport = process.env.SOURCE_MAP_SUPPORT;
if (sourceMapSupport && ['1', 'yes', 'true'].includes(sourceMapSupport.toLowerCase())) {
  require('source-map-support').install();
}

const { VERSION } = require('./version');
const VERSION_CONSUMER = process.env.VERSION_CONSUMER || '0.0.0';
const VERSION_COMPONENT = process.env.VERSION_COMPONENT || '0.0.0';

const authorize = require('./authorize');
const openIdConfiguration = require('./open-id-configuration');
const token = require('./token');
const userinfo = require('./userinfo');
const jwks = require('./jwks');
const logger = require('../logger');
const { validate } = require('../../utils/validator');
const rateLimiter = require('../../utils/rate-limiter');
const { withRetry } = require('../../utils/retry');

// Map endpoints to their validation schemas and handlers
const endpointConfig = {
  '/authorize': {
    schema: 'authorize',
    handler: authorize.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET', 'POST'],
    cacheControl: 'no-store'
  },
  '/.well-known/openid-configuration': {
    schema: null, // No validation needed
    handler: openIdConfiguration.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400'
  },
  '/token': {
    schema: 'token',
    handler: token.handler,
    requiresRateLimit: true,
    allowedMethods: ['POST'],
    cacheControl: 'no-store'
  },
  '/userinfo': {
    schema: 'userinfo',
    handler: userinfo.handler,
    requiresRateLimit: true,
    allowedMethods: ['GET', 'POST'],
    cacheControl: 'no-store'
  },
  '/.well-known/jwks.json': {
    schema: null,
    handler: jwks.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400'
  },
  '/jwks.json': {
    schema: null,
    handler: jwks.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400'
  }
};

// Extract parameters based on HTTP method
function getParameters(event) {
  const params = {};
  
  // Query parameters
  if (event.queryStringParameters) {
    Object.assign(params, event.queryStringParameters);
  }
  
  // POST body
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      Object.assign(params, body);
    } catch (error) {
      logger.warn({
        message: 'Failed to parse request body',
        error: error.message
      });
    }
  }
  
  // Authorization header for userinfo endpoint
  if (event.headers && event.headers.Authorization) {
    params.access_token = event.headers.Authorization.replace('Bearer ', '');
  }
  
  return params;
}

// Format response with proper headers
function formatResponse(response, config) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': config.cacheControl,
    // CORS headers
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': config.allowedMethods.join(','),
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400'
  };

  // Don't override existing headers
  if (response.headers) {
    Object.assign(headers, response.headers);
  }

  return {
    ...response,
    headers
  };
}

// Main handler function
async function processRequest(event, context, callback, config) {
  try {
    // Check HTTP method
    if (!config.allowedMethods.includes(event.httpMethod)) {
      return callback(null, formatResponse({
        statusCode: 405,
        body: JSON.stringify({
          error: 'method_not_allowed',
          error_description: `Method ${event.httpMethod} not allowed`
        })
      }, config));
    }

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return callback(null, formatResponse({
        statusCode: 204
      }, config));
    }

    // Get and validate parameters
    const params = getParameters(event);
    if (config.schema) {
      try {
        validate(config.schema, params);
      } catch (error) {
        return callback(null, formatResponse({
          statusCode: 400,
          body: JSON.stringify({
            error: 'invalid_request',
            error_description: error.message,
            validation_errors: error.errors
          })
        }, config));
      }
    }

    // Check rate limits if required
    if (config.requiresRateLimit) {
      await rateLimiter.checkLimit();
    }

    // Wrap handler in retry mechanism
    const response = await withRetry(
      () => new Promise((resolve, reject) => {
        config.handler(event, context, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      })
    );

    // Format and return response
    return callback(null, formatResponse(response, config));
  } catch (error) {
    logger.error({
      message: 'Request processing failed',
      error: error.message,
      stack: error.stack,
      path: event.path,
      requestId: context.awsRequestId
    });

    // Handle rate limit errors
    if (rateLimiter.isRateLimitError(error)) {
      return callback(null, formatResponse({
        statusCode: 429,
        headers: {
          'Retry-After': '60'
        },
        body: JSON.stringify({
          error: 'rate_limit_exceeded',
          error_description: 'Rate limit exceeded. Please try again later.'
        })
      }, config));
    }

    // Generic error response
    return callback(null, formatResponse({
      statusCode: 500,
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    }, config));
  }
}

// Main Lambda handler
exports.handler = (event, context, callback) => {
  // Log request details
  logger.info({
    message: 'Lambda invoked',
    version: VERSION,
    versionConsumer: VERSION_CONSUMER,
    versionComponent: VERSION_COMPONENT,
    path: event.path,
    method: event.httpMethod,
    requestId: context.awsRequestId,
    memoryUsage: process.memoryUsage()
  });

  // Get endpoint configuration
  const config = endpointConfig[event.path];
  if (!config) {
    return callback(null, formatResponse({
      statusCode: 404,
      body: JSON.stringify({
        error: 'not_found',
        error_description: 'Endpoint not found'
      })
    }, { cacheControl: 'no-store', allowedMethods: ['GET'] }));
  }

  // Process request with endpoint-specific configuration
  return processRequest(event, context, callback, config);
};
