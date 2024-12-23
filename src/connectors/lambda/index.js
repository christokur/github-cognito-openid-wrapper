// Enable source map support if enabled via environment variable
const sourceMapSupport = process.env.SOURCE_MAP_SUPPORT;
if (
  sourceMapSupport &&
  ['1', 'yes', 'true'].includes(sourceMapSupport.toLowerCase())
) {
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
const validator = require('../../utils/validator');
const rateLimiter = require('../../utils/rate-limiter');
const { withRetry } = require('../../utils/retry');

// Map endpoints to their validation schemas and handlers
const endpointConfig = {
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
    allowedMethods: ['GET'],
    cacheControl: 'no-store',
    requiresAuth: true,
  },
  '/.well-known/jwks.json': {
    schema: null,
    handler: jwks.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400',
  },
  '/jwks.json': {
    schema: null,
    handler: jwks.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=86400',
  },
  '/favicon.ico': {
    schema: null,
    handler: favicon.handler,
    requiresRateLimit: false,
    allowedMethods: ['GET'],
    cacheControl: 'public, max-age=31536000',
  },
};

// Define functions
function parseBody(event) {
  if (!event) {
    logger.debug({
      message: 'parseBody received null event',
    });
    return { body: undefined, contentType: '' };
  }

  // Extract body even if headers missing
  let { body } = event;
  const headers = event.headers || {};
  const contentType = headers['content-type'] || headers['Content-Type'] || '';

  if (body) {
    if (event.isBase64Encoded) {
      try {
        // Use atob to validate base64 first
        const decoded = Buffer.from(body, 'base64').toString();
        // Check if decoded string contains invalid characters
        if (decoded.includes('�')) {
          logger.debug({
            message: 'Invalid base64 data detected',
            body,
          });
          return { body, contentType };
        }
        body = decoded;
        event.body = body;
        event.isBase64Encoded = false;
        logger.debug({
          message: 'parseBody decoded base64',
          event,
        });
      } catch (error) {
        logger.debug({
          message: 'Failed to decode base64',
          error: error.message,
        });
        return { body, contentType };
      }
    }

    if (
      contentType &&
      contentType.startsWith('application/x-www-form-urlencoded')
    ) {
      try {
        body = typeof body === 'string' ? querystring.parse(body) : body;
        event.body = body;
        event.headers = headers;
        event.headers['content-type'] = 'application/javascript';
        logger.debug({
          message: 'Parsed x-www-form-urlencoded data',
          contentType: event.headers['content-type'],
          body,
        });
      } catch (error) {
        logger.debug({
          message: 'Failed to parse form data',
          error: error.message,
        });
        return { body, contentType };
      }
    } else if (contentType && contentType.startsWith('application/json')) {
      try {
        body = typeof body === 'string' ? JSON.parse(body) : body;
        event.body = body;
        event.headers = headers;
        event.headers['content-type'] = 'application/javascript';
        logger.debug({
          message: 'Parsed JSON body',
          contentType: event.headers['content-type'],
          body,
        });
      } catch (error) {
        logger.debug({
          message: 'Failed to parse JSON',
          error: error.message,
        });
        return { body, contentType };
      }
    } else {
      logger.debug({
        message: 'Using raw body data',
        contentType,
        body,
      });
    }
  }
  return { body, contentType };
}

function getParameters(event) {
  const params = {};

  // Query parameters
  if (event.queryStringParameters) {
    Object.assign(params, event.queryStringParameters);
  }

  // body
  if (event.body) {
    const { body: parsedBody, contentType } = parseBody(event);
    logger.debug({
      message: 'Parsed request body',
      contentType,
      body: parsedBody,
    });
    event.body = parsedBody;
    Object.assign(params, parsedBody);
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
    'Access-Control-Max-Age': '86400',
  };

  // Don't override existing headers
  if (response.headers) {
    Object.assign(headers, response.headers);
  }

  // Handle binary responses (e.g., favicon)
  if (response.isBase64Encoded) {
    return {
      ...response,
      headers,
    };
  }

  // Handle JSON responses
  return {
    ...response,
    headers,
  };
}

// Main handler function
function processRequest(event, context, config) {
  try {
    logger.debug({
      message: 'Processing request',
      path: event.path,
      httpMethod: event.httpMethod,
      headers: event.headers,
      body: event.body,
      config,
    });
    // 1. Check HTTP method first
    if (!config.allowedMethods.includes(event.httpMethod)) {
      return formatResponse(
        {
          statusCode: 405,
          body: JSON.stringify({
            error: 'method_not_allowed',
            error_description: `Method ${event.httpMethod} not allowed`,
          }),
        },
        config,
      );
    }

    // 2. Check authorization if required
    if (config.requiresAuth) {
      const authHeader = event.headers?.Authorization;
      if (!authHeader) {
        return formatResponse(
          {
            statusCode: 401,
            body: JSON.stringify({
              error: 'unauthorized',
              error_description: 'No valid access token provided',
            }),
          },
          config,
        );
      }
    }

    // 3. Get parameters
    const params = getParameters(event);

    logger.debug({
      message: 'Request parameters',
      params,
    });

    // 4. Validate parameters
    if (config.schema) {
      try {
        logger.debug({
          message: 'Validating parameters',
          schema: config.schema,
          params,
        });
        validator.validate(config.schema, params);
      } catch (error) {
        return formatResponse(
          {
            statusCode: error.statusCode || 400,
            body: JSON.stringify({
              error: error.code || 'invalid_request',
              error_description: error.message,
              validation_errors: error.errors,
            }),
          },
          config,
        );
      }
    }

    // Check rate limits if required
    if (config.requiresRateLimit) {
      rateLimiter.checkLimit();
    }

    // Wrap handler in retry mechanism
    const response = withRetry(() => config.handler(event, context));

    // Format and return response
    return formatResponse(response, config);
  } catch (error) {
    logger.error({
      message: 'Request processing failed',
      error: error.message,
      stack: error.stack,
      path: event.path,
      requestId: context.awsRequestId,
    });

    // Handle rate limit errors
    if (rateLimiter.isRateLimitError(error)) {
      return formatResponse(
        {
          statusCode: 429,
          headers: {
            'Retry-After': '60',
          },
          body: JSON.stringify({
            error: 'rate_limit_exceeded',
            error_description: 'Rate limit exceeded. Please try again later.',
          }),
        },
        config,
      );
    }

    // Generic error response
    return formatResponse(
      {
        statusCode: 500,
        body: JSON.stringify({
          error: 'server_error',
          error_description: 'Internal server error',
        }),
      },
      config,
    );
  }
}

function handler(event, context, callback) {
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
    memoryUsage: process.memoryUsage(),
  });

  // Get endpoint configuration
  logger.info({
    message: 'Looking up endpoint config',
    path: event.path || '',
    pathType: typeof event.path,
    pathLength: event.path ? event.path.length : 0,
    pathCharCodes: event.path ? Array.from(event.path).map((c) => c.charCodeAt(0)) : [],
    availableEndpoints: Object.keys(endpointConfig),
  });
  const path = event.path ? event.path.replace(/\/$/, '') : ''; // Remove trailing slash
  logger.debug({
    message: 'Path comparison',
    originalPath: event.path,
    cleanedPath: path,
    config: endpointConfig[path],
    hasConfig: path in endpointConfig,
  });
  const config = endpointConfig[path];
  if (!config) {
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
  const response = processRequest(event, context, config);
  if (typeof callback === 'function') {
    return callback(null, response);
  }
  return response;
}

// Export all functions
module.exports = {
  parseBody,
  getParameters,
  formatResponse,
  processRequest,
  handler,
};
