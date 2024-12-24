const querystring = require('querystring');
const logger = require('../logger');

function parseBody(event) {
  if (!event) {
    logger.debug({
      message: 'parseBody received null event',
    });
    return { body: undefined, contentType: '' };
  }

  if (!event.body) {
    return { body: undefined, contentType: '' };
  }

  try {
    // Handle base64 encoded bodies
    let rawBody = event.body;
    if (event.isBase64Encoded) {
      try {
        const decoded = Buffer.from(event.body, 'base64').toString();
        // Check if the decoded string is valid UTF-8
        if (decoded.includes('�')) {
          throw new Error('Invalid UTF-8 sequence');
        }
        rawBody = decoded;
        event.isBase64Encoded = false;
      } catch (e) {
        // Return original body on base64 decode error
        logger.error({
          message: 'Failed to decode base64 body',
          error: e.message,
          body: event.body,
        });
        return { body: event.body, contentType: '' };
      }
    }

    logger.debug({
      message: 'Parsing request body',
      isBase64Encoded: event.isBase64Encoded,
      originalBody: event.body,
      decodedBody: rawBody,
    });

    // Get content type
    const contentType = getHeaderCaseInsensitive(event.headers, 'Content-Type') || '';

    // Parse based on content type
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      let parsed;
      // If body is already an object, use it directly
      if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
        logger.debug({
          message: 'Using pre-parsed form body',
          contentType,
          parsedBody: rawBody,
        });
        parsed = rawBody;
      } else {
        // Otherwise parse the string body
        parsed = querystring.parse(rawBody);
        logger.debug({
          message: 'Parsed form-urlencoded body',
          contentType,
          body: parsed,
        });
      }
      if (event.headers) {
        event.headers['content-type'] = 'application/javascript';
      }
      event.body = parsed;
      return { body: parsed, contentType: 'application/javascript' };
    }
    if (contentType?.includes('application/json')) {
      try {
        const parsed = JSON.parse(rawBody);
        logger.debug({
          message: 'Parsed JSON body',
          contentType,
          parsedBody: parsed,
        });
        if (event.headers) {
          event.headers['content-type'] = 'application/javascript';
        }
        event.body = parsed;
        return { body: parsed, contentType: 'application/javascript' };
      } catch (e) {
        // Return raw body on JSON parse error
        logger.error({
          message: 'Failed to parse JSON body',
          error: e.message,
          body: rawBody,
        });
        event.body = rawBody;
        return { body: rawBody, contentType };
      }
    }

    // Default to raw body if content type not recognized
    logger.debug({
      message: 'Using raw body',
      body: rawBody,
    });
    event.body = rawBody;
    return { body: rawBody, contentType };
  } catch (error) {
    logger.error({
      message: 'Failed to parse request body',
      error: error.message,
      body: event.body,
      isBase64Encoded: event.isBase64Encoded,
    });
    return { body: event.body, contentType: '' };
  }
}

function getParameters(event) {
  const params = {};

  // Get query string parameters
  if (event.queryStringParameters) {
    Object.assign(params, event.queryStringParameters);
  }

  logger.debug({
    message: 'Extracted query parameters',
    queryParams: params,
  });

  // Get body parameters
  if (event.body) {
    const bodyParams = parseBody(event);
    Object.assign(params, bodyParams.body);
    logger.debug({
      message: 'Added body parameters',
      bodyParams: bodyParams.body,
      finalParams: params,
    });
  }

  // Get token from Authorization header
  const authHeader = getHeaderCaseInsensitive(event.headers, 'Authorization');
  if (authHeader) {
    params.access_token = authHeader.replace('Bearer ', '');
    logger.debug({
      message: 'Added access token from Authorization header',
      hasToken: !!params.access_token,
    });
  }

  return params;
}

/**
 * Get a header value in a case-insensitive way
 * @param {Object} headers - Headers object from event
 * @param {string} headerName - Name of header to find
 * @returns {string|undefined} Header value if found
 */
function getHeaderCaseInsensitive(headers, headerName) {
  if (!headers || !headerName) return undefined;
  
  const headerKey = Object.keys(headers)
    .find(key => key.toLowerCase() === headerName.toLowerCase());
  
  return headerKey ? headers[headerKey] : undefined;
}

module.exports = {
  parseBody,
  getParameters,
  getHeaderCaseInsensitive,
};
