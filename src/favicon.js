const fs = require('fs').promises;
const path = require('path');
const logger = require('./connectors/logger');
const {
  verifyRequest,
  verifyResponse,
  verifyIco,
} = require('./utils/favicon-verifier');

let base64Part;
let faviconBuffer;

// Initialize favicon data
async function initializeFavicon() {
  try {
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
      const faviconPath = path.join(__dirname, 'assets', 'favicon.ico');
      // For filesystem, we need to encode to base64
      const faviconBin = await fs.readFile(faviconPath);
      base64Part = faviconBin.toString('base64');
    }

    // Initialize the buffer
    faviconBuffer = Buffer.from(base64Part, 'base64');
    logger.debug('Initialized favicon from base64 string', {
      base64Length: base64Part.length,
      bufferLength: faviconBuffer.length,
      bufferStart: faviconBuffer.subarray(0, 8).toString('hex'),
    });
  } catch (error) {
    logger.error('Failed to initialize favicon:', error);
    throw error;
  }
}

// Handler for favicon requests
async function handler(event, context) {
  try {
    // Initialize favicon if not already done
    if (!faviconBuffer) {
      try {
        await initializeFavicon();
      } catch (error) {
        return {
          statusCode: 500,
          body: 'Internal Server Error'
        };
      }
    }

    // Always verify request as it's a security check
    await verifyRequest(event);

    // Verify the ICO format
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Verifying ICO format', {
        firstBytes: faviconBuffer.subarray(0, 4).toString('hex'),
        expectedBytes: '00000100',
      });
      await verifyIco(faviconBuffer);
    }

    // Generate response with the binary buffer directly encoded to base64
    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000',
      },
      body: base64Part,
      isBase64Encoded: true,
    };

    // Only verify response in debug mode to save CPU
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Verifying favicon response');
      await verifyResponse(response);
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
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
}

// Initialize favicon on module load
initializeFavicon().catch((error) => {
  logger.error('Failed to initialize favicon on module load:', error);
});

// Export handler
module.exports = { handler, initializeFavicon };
