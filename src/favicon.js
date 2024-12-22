const fs = require('fs');
const path = require('path');
const logger = require('./connectors/logger');
const { verifyRequest, verifyResponse, verifyIco } = require('./utils/favicon-verifier');

let faviconBuffer;
let faviconBase64;

// Try webpack-bundled asset first (for Lambda)
try {
    const webpackAsset = require('./assets/favicon.ico');
    // Keep the binary buffer for verification
    faviconBuffer = Buffer.from(webpackAsset.split('base64,')[1], 'base64');
    // But store the base64 string for response
    faviconBase64 = webpackAsset.split('base64,')[1];
    logger.info('Loaded favicon from webpack bundle');
} catch (error) {
    // Fallback to direct file access (for local development)
    try {
        const faviconPath = path.join(__dirname, 'assets', 'favicon.ico');
        // For filesystem, we need to encode to base64
        faviconBuffer = fs.readFileSync(faviconPath);
        faviconBase64 = faviconBuffer.toString('base64');
        logger.info('Loaded favicon from filesystem');
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

        // Verify ICO format before sending
        if (process.env.LOG_LEVEL === 'debug') {
            logger.debug('Verifying favicon response');
            verifyIco(faviconBuffer);
        }

        // Generate response
        const response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'image/x-icon',
                'Cache-Control': 'public, max-age=31536000'
            },
            body: faviconBase64,
            isBase64Encoded: true
        };

        // Only verify response in debug mode to save CPU
        if (process.env.LOG_LEVEL === 'debug') {
            logger.debug('Verifying favicon response');
            verifyResponse(response);
        }

        return response;
    } catch (error) {
        logger.error('Error serving favicon:', error);
        throw error;
    }
}

module.exports = { handler };
