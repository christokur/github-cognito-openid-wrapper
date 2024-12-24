const logger = require('../logger');
const responseUtils = require('./response-utils');
const { getParameters, getHeaderCaseInsensitive } = require('./request-utils');
const validator = require('../../utils/validator');
const rateLimiter = require('../../utils/rate-limiter');
const { withRetry } = require('../../utils/retry');

// Main handler function
async function processRequest(event, context, config) {
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
      return responseUtils.formatResponse(
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
      const authHeader = getHeaderCaseInsensitive(event.headers, 'Authorization');
      if (!authHeader) {
        return responseUtils.formatResponse(
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
        return responseUtils.formatResponse(
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
      try {
        await rateLimiter.checkLimit();
      } catch (error) {
        if (error.statusCode === 429) {
          return responseUtils.formatResponse(
            {
              statusCode: 429,
              headers: {
                'Retry-After': error.retryAfter.toString(),
              },
              body: JSON.stringify({
                error: 'rate_limit_exceeded',
                error_description: 'Rate limit exceeded',
              }),
            },
            config,
          );
        }
        throw error;
      }
    }

    // Wrap handler in retry mechanism
    const response = await withRetry(async () => {
      // Call the handler and await its response
      const result = await config.handler(event, context);
      return result;
    });

    // Format and return response
    return responseUtils.formatResponse(response, config);
  } catch (error) {
    logger.error({
      message: 'Request processing failed',
      error: error.message,
      stack: error.stack,
      path: event.path,
      requestId: context.awsRequestId,
    });

    // Generic error response
    return responseUtils.formatResponse(
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

module.exports = processRequest;
