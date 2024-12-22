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
  if (buffer[0] !== 0x00 || buffer[1] !== 0x00) {
    throw new Error('Invalid ICO reserved bytes');
  }
  if (buffer[2] !== 0x01 || buffer[3] !== 0x00) {
    throw new Error('Invalid ICO type');
  }

  // Check image count
  const imageCount = buffer.readUInt16LE(4);
  if (imageCount === 0) {
    throw new Error('No images in ICO');
  }

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
      'Cache-Control': 'public, max-age=31536000'
    }
  };

  if (response.statusCode !== required.statusCode) {
    throw new Error('Invalid status code');
  }

  for (const [key, value] of Object.entries(required.headers)) {
    if (response.headers[key] !== value) {
      throw new Error(`Invalid header: ${key}`);
    }
  }

  if (!response.body) {
    throw new Error('Missing response body');
  }

  // Verify ICO format
  try {
    const buffer = response.isBase64Encoded 
      ? Buffer.from(response.body, 'base64')
      : Buffer.from(response.body);
    verifyIco(buffer);
  } catch (error) {
    throw new Error(`Invalid ICO format: ${error.message}`);
  }

  return true;
}

module.exports = {
  verifyRequest,
  verifyIco,
  verifyResponse
};
