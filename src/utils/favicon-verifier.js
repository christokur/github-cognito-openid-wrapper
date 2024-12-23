const logger = require('../connectors/logger');

/**
 * Verify the request for favicon.ico
 * @param {Object} event - The Lambda event object
 * @returns {boolean} True if request is valid
 * @throws {Error} If request is invalid
 */
function verifyRequest(event) {
  // Check HTTP method
  if (event.httpMethod !== 'GET') {
    throw new Error('Method not allowed');
  }

  // Check path
  if (event.path !== '/favicon.ico') {
    throw new Error('Invalid path');
  }

  // Check headers
  if (!event.headers) {
    throw new Error('Missing headers');
  }

  return true;
}

/**
 * Verify the ICO format of the binary data
 * @param {Buffer} buffer - Binary favicon data
 * @returns {boolean} True if format is valid
 * @throws {Error} If format is invalid
 */
function verifyIco(buffer) {
  // Check ICO header
  if (
    buffer[0] !== 0 ||
    buffer[1] !== 0 ||
    buffer[2] !== 1 ||
    buffer[3] !== 0
  ) {
    logger.debug('ICO header check failed', {
      byte0: buffer[0],
      byte1: buffer[1],
      byte2: buffer[2],
      byte3: buffer[3],
      expected: [0, 0, 1, 0],
    });
    return false;
  }

  logger.debug('ICO verification', {
    reservedBytes: [buffer[0], buffer[1]],
    typeBytes: [buffer[2], buffer[3]],
    bufferLength: buffer.length,
    bufferStart: buffer.slice(0, 8).toString('hex'),
  });

  return true;
}

/**
 * Verify the response structure
 * @param {Object} response - The response object
 * @returns {boolean} True if response is valid
 * @throws {Error} If response is invalid
 */
function verifyResponse(response) {
  const required = {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=31536000',
    },
  };

  if (response.statusCode !== required.statusCode) {
    throw new Error('Invalid status code');
  }

  // Check Content-Type header
  const contentType = response.headers['Content-Type'];
  const expectedType = required.headers['Content-Type'];
  if (!contentType || contentType.split(';')[0].trim() !== expectedType) {
    throw new Error('Invalid Content-Type header');
  }

  // Check Cache-Control header
  if (response.headers['Cache-Control'] !== required.headers['Cache-Control']) {
    throw new Error('Invalid Cache-Control header');
  }

  if (!response.body) {
    throw new Error('Missing response body');
  }

  // Verify ICO format
  try {
    const buffer = response.isBase64Encoded
      ? Buffer.from(response.body, 'base64')
      : Buffer.from(response.body);
    if (!verifyIco(buffer)) {
      throw new Error('Invalid ICO format');
    }
  } catch (error) {
    throw new Error(`Invalid ICO format: ${error.message}`);
  }

  return true;
}

module.exports = {
  verifyRequest,
  verifyIco,
  verifyResponse,
};
