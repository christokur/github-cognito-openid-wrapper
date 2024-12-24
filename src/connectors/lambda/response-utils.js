const logger = require('../logger');

// Format response with proper headers
function formatResponse(response, config = {}) {
  logger.debug({
    message: 'Formatting response',
    originalResponse: response,
    config,
  });

  const headers = {};

  // Add Content-Type for JSON responses
  if (
    response.body &&
    typeof response.body === 'string' &&
    response.body.startsWith('{')
  ) {
    headers['Content-Type'] = 'application/json';
    logger.debug({
      message: 'Added JSON content type header',
      contentType: headers['Content-Type'],
    });
  }

  // Add optional headers
  if (config.cacheControl) {
    headers['Cache-Control'] = config.cacheControl;
    logger.debug({
      message: 'Added cache control header',
      cacheControl: headers['Cache-Control'],
    });
  }

  // Add CORS headers if enabled
  const cors = config?.cors || false;
  if (cors) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': (config.allowedMethods || ['GET']).join(','),
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
    };
    Object.assign(headers, corsHeaders);
    logger.debug({
      message: 'Added CORS headers',
      corsHeaders,
    });
  }

  // Don't override existing headers
  if (response.headers) {
    Object.assign(headers, response.headers);
    logger.debug({
      message: 'Merged existing headers',
      existingHeaders: response.headers,
      finalHeaders: headers,
    });
  }

  // Handle binary responses (e.g., favicon)
  if (response.isBase64Encoded) {
    logger.debug({
      message: 'Formatting base64 encoded response',
      isBase64Encoded: true,
      contentLength: response.body?.length,
    });
    return {
      ...response,
      headers,
    };
  }

  // Handle JSON responses
  const formattedResponse = {
    ...response,
    headers,
  };

  logger.debug({
    message: 'Formatted final response',
    statusCode: formattedResponse.statusCode,
    headers: formattedResponse.headers,
    bodyLength: formattedResponse.body?.length,
    isBase64Encoded: formattedResponse.isBase64Encoded,
  });

  return formattedResponse;
}

module.exports = {
  formatResponse,
};
