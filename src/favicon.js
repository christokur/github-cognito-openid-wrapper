const fs = require('fs');
const path = require('path');
const logger = require('./connectors/logger');
const {
  verifyRequest,
  verifyResponse,
  verifyIco,
} = require('./utils/favicon-verifier');

let base64Part;
let faviconBuffer;

// Try webpack-bundled asset first (for Lambda)
try {
  const webpackAsset = require('./assets/favicon.ico');
  // Extract the base64 data from the data URL
  [, base64Part] = webpackAsset.split('base64,');
  if (!base64Part) {
    logger.error('Invalid asset format', {
      assetStart: webpackAsset.substring(0, 50),
    });
    throw new Error('Invalid asset format');
  }
} catch (error) {
  // Fallback to direct file access (for local development)
  try {
    const faviconPath = path.join(__dirname, 'assets', 'favicon.ico');
    // For filesystem, we need to encode to base64
    const faviconBin = fs.readFileSync(faviconPath);
    base64Part = faviconBin.toString('base64');
  } catch (fsError) {
    logger.error('Failed to load favicon:', fsError);
    throw fsError;
  }
}

// Handler for favicon requests
function handler(event, context) {
  try {
    // Always verify request as it's a security check
    verifyRequest(event);

    // Decode base64 to binary buffer
    faviconBuffer = Buffer.from(base64Part, 'base64');
    logger.debug('Loaded favicon from base64 string', {
      base64Length: base64Part.length,
      bufferLength: faviconBuffer.length,
      bufferStart: faviconBuffer.subarray(0, 8).toString('hex'),
    });
    logger.info('Loaded favicon from base64 string');

    // Verify the ICO format
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Verifying ICO format', {
        firstBytes: faviconBuffer.subarray(0, 4).toString('hex'),
        expectedBytes: '00000100',
      });
      verifyIco(faviconBuffer);
    }

    // Generate response with the binary buffer directly encoded to base64
    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000',
      },
      body: faviconBuffer.toString('base64'),
      isBase64Encoded: true,
    };

    // Only verify response in debug mode to save CPU
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Verifying favicon response');
      verifyResponse(response);
      logger.debug('API response', {
        isBase64Encoded: response.isBase64Encoded,
        bodyLength: response.body.length,
        decodedLength: Buffer.from(response.body, 'base64').length,
        firstBytes: Buffer.from(response.body, 'base64')
          .subarray(0, 4)
          .toString('hex'),
      });
    }

    return response;
  } catch (error) {
    logger.error('Error serving favicon:', error);
    throw error;
  }
}

module.exports = { handler };
