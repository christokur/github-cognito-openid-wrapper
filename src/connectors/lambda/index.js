// Enable source map support if enabled via environment variable
const sourceMapSupport = process.env.SOURCE_MAP_SUPPORT;
if (sourceMapSupport && ['1', 'yes', 'true'].includes(sourceMapSupport.toLowerCase())) {
  require('source-map-support').install();
}

const querystring = require('querystring');
const { VERSION } = require('./version');

const VERSION_CONSUMER = process.env.VERSION_CONSUMER || '0.0.0';
const VERSION_COMPONENT = process.env.VERSION_COMPONENT || '0.0.0';

const authorize = require('./authorize');
const openIdConfiguration = require('./open-id-configuration');
const token = require('./token');
const userinfo = require('./userinfo');
const jwks = require('./jwks');
const favicon = require('../../favicon');
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
    allowedMethods: ['GET'],
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
    allowedMethods: ['GET'],
    cacheControl: 'no-store',
    requiresAuth: true
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
  },
  '/favicon.ico': {
    schema: null,
    handler: favicon.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=31536000'
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
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    try {
      if (contentType.startsWith('application/x-www-form-urlencoded')) {
        const body = querystring.parse(event.body);
        Object.assign(params, body);
      } else if (contentType.startsWith('application/json')) {
        const body = JSON.parse(event.body);
        Object.assign(params, body);
      } else {
        logger.warn({
          message: 'Unsupported content type',
          contentType
        });
      }
    } catch (error) {
      logger.warn({
        message: 'Failed to parse request body',
        error: error.message,
        contentType
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
function processRequest(event, context, config) {
  try {
    // 1. Check HTTP method first
    if (!config.allowedMethods.includes(event.httpMethod)) {
      return formatResponse({
        statusCode: 405,
        body: JSON.stringify({
          error: 'method_not_allowed',
          error_description: `Method ${event.httpMethod} not allowed`
        })
      }, config);
    }

    // 2. Check authorization if required
    if (config.requiresAuth) {
      const authHeader = event.headers?.Authorization;
      if (!authHeader) {
        return formatResponse({
          statusCode: 401,
          body: JSON.stringify({
            error: 'unauthorized',
          error_description: 'No valid access token provided'
          })
        }, config);
      }
    }

    // 3. Get parameters
    const params = getParameters(event);

    // 4. Validate parameters
    if (config.schema) {
      try {
        validate(config.schema, params);
      } catch (error) {
        return formatResponse({
          statusCode: 400,
          body: JSON.stringify({
            error: 'invalid_request',
            error_description: error.message,
            validation_errors: error.errors
          })
        }, config);
      }
    }

    // Check rate limits if required
    if (config.requiresRateLimit) {
      rateLimiter.checkLimit();
    }

    // Wrap handler in retry mechanism
    const response = withRetry(() => {
      return config.handler(event, context);
    });

    // Format and return response
    return formatResponse(response, config);
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
      return formatResponse({
        statusCode: 429,
        headers: {
          'Retry-After': '60'
        },
        body: JSON.stringify({
          error: 'rate_limit_exceeded',
          error_description: 'Rate limit exceeded. Please try again later.'
        })
      }, config);
    }

    // Generic error response
    return formatResponse({
      statusCode: 500,
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    }, config);
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
    event,
    context,
    memoryUsage: process.memoryUsage()
  });

  // Get endpoint configuration
  logger.info({
    message: 'Looking up endpoint config',
    path: event.path,
    pathType: typeof event.path,
    pathLength: event.path.length,
    pathCharCodes: Array.from(event.path).map(c => c.charCodeAt(0)),
    availableEndpoints: Object.keys(endpointConfig)
  });
  const path = event.path.replace(/\/$/, ''); // Remove trailing slash
  logger.debug({
    message: 'Path comparison',
    originalPath: event.path,
    cleanedPath: path,
    config: endpointConfig[path],
    hasConfig: path in endpointConfig
  });
  const config = endpointConfig[path];
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
  return callback(null, processRequest(event, context, config));
};
