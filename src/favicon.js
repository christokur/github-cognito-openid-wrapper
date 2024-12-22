const fs = require('fs');
const path = require('path');
const logger = require('./connectors/logger');
const { verifyRequest, verifyResponse } = require('./utils/favicon-verifier');

let faviconBuffer;

// Try webpack-bundled asset first (for Lambda)
try {
    const webpackAsset = require('./assets/favicon.ico');
    faviconBuffer = Buffer.from(webpackAsset.default || webpackAsset, 'base64');
    logger.info('Loaded favicon from webpack bundle');
} catch (error) {
    // Fallback to direct file access (for local development)
    try {
        const faviconPath = path.join(__dirname, 'assets', 'favicon.ico');
        faviconBuffer = fs.readFileSync(faviconPath);
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

        // Generate response
        const response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'image/x-icon',
                'Cache-Control': 'public, max-age=31536000'
            },
            body: faviconBuffer,
            isBase64Encoded: false
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
