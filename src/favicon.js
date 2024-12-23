const fs = require('fs');
const path = require('path');
const logger = require('./connectors/logger');
const { verifyRequest, verifyResponse, verifyIco } = require('./utils/favicon-verifier');

let faviconBuffer;
let faviconBase64;

// Try webpack-bundled asset first (for Lambda)
try {
    const webpackAsset = require('./assets/favicon.ico');
    // Webpack packs it as "data:image/vnd.microsoft.icon;base64,..."
    // Extract just the base64 part after the comma
    const base64Part = webpackAsset.split('base64,')[1];
    if (!base64Part) {
        throw new Error('Invalid webpack asset format');
    }
    // Keep the binary buffer for verification
    faviconBuffer = Buffer.from(base64Part, 'base64');
    // Store base64 string for response
    faviconBase64 = base64Part;
    logger.debug('Loaded favicon from webpack bundle', {
        bufferLength: faviconBuffer.length,
        base64Length: faviconBase64.length,
        bufferStart: faviconBuffer.slice(0, 8).toString('hex')
    });
    logger.info('Loaded favicon from webpack bundle');
} catch (error) {
    // Fallback to direct file access (for local development)
    try {
        const faviconPath = path.join(__dirname, 'assets', 'favicon.ico');
        // For filesystem, we need to encode to base64
        faviconBuffer = fs.readFileSync(faviconPath);
        faviconBase64 = faviconBuffer.toString('base64');
        logger.debug('Loaded favicon from filesystem', {
            bufferLength: faviconBuffer.length,
            base64Length: faviconBase64.length,
            bufferStart: faviconBuffer.slice(0, 8).toString('hex')
        });
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
                'Content-Type': 'image/x-icon; charset=utf-8',
                'Cache-Control': 'public, max-age=31536000'
            },
            body: faviconBase64,
            isBase64Encoded: true
        };

        // Only verify response in debug mode to save CPU
        if (process.env.LOG_LEVEL === 'debug') {
            logger.debug('Verifying favicon response');
            verifyResponse(response);
            logger.debug('API response', {
                isBase64Encoded: response.isBase64Encoded,
                bodyLength: response.body.length,
                decodedLength: Buffer.from(response.body, 'base64').length,
                firstBytes: Buffer.from(response.body, 'base64').slice(0, 4)
            });
        }

        return response;
    } catch (error) {
        logger.error('Error serving favicon:', error);
        throw error;
    }
}

module.exports = { handler };
