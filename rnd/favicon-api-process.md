# Favicon API Process

This document describes how the API handles requests for /favicon.ico,
with automatic verification at each stage.

## Overview

When a client requests the favicon.ico file, the API processes
the request through several stages to return the ICO file.
The implementation supports both local development and Lambda deployment scenarios.

## Development Journey

### 1. Initial Problem Identification

We started by running the endpoint tests:

```bash
node scripts/test-endpoints.js --favicon
```

This revealed issues with the favicon serving:

- Content type verification failed
- ICO format validation failed
- Cache control headers were missing
- Asset loading inconsistency between local and Lambda environments

### 2. Solution Development

1. Created robust favicon generation tools:
   - Python-based ICO converter
   - Multi-size ICO support (16x16, 24x24, 32x32)
   - Extensive format verification

2. Enhanced verification tools:
   - ICO format validation
   - File integrity verification

3. Improved asset management:
   - Dual-mode asset loading (webpack/direct)
   - Proper error handling for both modes
   - Consistent file structure

## Current Implementation

### 1. Asset Loading Strategy

The implementation supports two modes:

#### Lambda Mode (Production)

- Uses webpack asset bundling
- Assets are embedded in the deployment package
- Loaded via webpack's require mechanism

#### Local Development Mode

- Direct filesystem access
- Assets loaded from src/assets directory
- Raw binary data reading
- Faster development cycle

Example implementation:

```javascript
// Try webpack-bundled asset first (for Lambda)
try {
    const webpackAsset = require('./assets/favicon.ico');
    faviconBuffer = webpackAsset.default || webpackAsset;
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
```

### 2. Request Processing

- **Input**: GET request to /favicon.ico
- **Actions**:
  - Receive HTTP request
  - Validate HTTP method (must be GET)
  - Check request headers
- **Automatic Verification**:
  - Verify request method is GET
  - Verify path exactly matches "/favicon.ico"
  - Verify request headers

### 3. Response Generation

- **Input**: Verified ICO buffer
- **Actions**:
  - Serve binary ICO data directly
  - Set proper headers
  - Generate Lambda response
- **Automatic Verification**:
  - Always verify request (security)
  - Verify response only in debug mode:

    ```javascript
    // Only verify response in debug mode to save CPU
    if (process.env.LOG_LEVEL === 'debug') {
        logger.debug('Verifying favicon response');
        verifyResponse(response);
    }
    ```
- **Response Format**:

  ```javascript
  {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=31536000'
    },
    body: faviconBuffer,
    isBase64Encoded: false
  }
  ```

Note: We serve the ICO file as direct binary data without base64 encoding since
API Gateway can handle binary responses for image/x-icon content type.

## Testing

### Local Development Testing

```bash
# Start local server with debug mode
LOG_LEVEL=debug npm run dev

# Test favicon endpoint (full verification)
LOG_LEVEL=debug node scripts/test-endpoints.js --favicon

# Test favicon endpoint (production mode)
node scripts/test-endpoints.js --favicon

# Manual verification
curl -I http://localhost:3000/favicon.ico
```

### Lambda Deployment Testing

```bash
# Build Lambda package
npm run build

# Deploy to test environment
npm run deploy:test

# Test deployed endpoint
curl -I https://your-api-gateway-url/favicon.ico
```

## Asset Generation

To generate a new favicon:

```bash
# Convert PNG to multi-size ICO
python3 rnd/favicon.py input.png src/assets/favicon.ico

# Verify the generated ICO
python3 rnd/favicon/verify_ico.py src/assets/favicon.ico

# Rebuild if running in development mode
npm run build
```

## Webpack Configuration

The webpack configuration includes special handling for .ico files:

```javascript
{
  test: /\.ico$/,
  type: 'asset/resource',
  generator: {
    filename: '[name][ext]'
  }
}
```

This ensures proper bundling of the favicon for Lambda deployment while maintaining compatibility with local development.

## Process Steps

### 1. Request Reception

- **Input**: GET request to /favicon.ico
- **Actions**:
  - Receive HTTP request
  - Validate HTTP method (must be GET)
  - Check request headers
- **Automatic Verification**:
  - Verify request method is GET
  - Verify path exactly matches "/favicon.ico"
  - Verify request headers

### 2. Lambda Handler

- **Actions**:
  - Trigger Lambda function
  - Parse request path and method
  - Validate request parameters
- **Automatic Verification**:
  - Verify Lambda context
  - Verify event structure

### 3. Endpoint Configuration

- **Actions**:
  - Validate against endpoint config
  - Check allowed methods
  - Prepare response headers
- **Automatic Verification**:
  - Verify endpoint configuration
  - Verify response headers

### 4. Favicon Loading

- **Actions**:
  - Import favicon.js module
  - Extract ICO buffer
- **Automatic Verification**:
  - Verify module loading
  - Verify ICO content

### 5. Response Generation

- **Input**: Verified ICO buffer
- **Actions**:
  - Serve binary ICO data directly
  - Set proper headers
  - Generate Lambda response
- **Automatic Verification**:
  - Always verify request (security)
  - Verify response only in debug mode:

    ```javascript
    // Only verify response in debug mode to save CPU
    if (process.env.LOG_LEVEL === 'debug') {
        logger.debug('Verifying favicon response');
        verifyResponse(response);
    }
    ```

## Error Handling

### Request Errors

```javascript
function handleRequestError(error) {
  logger.error('Request error:', error);
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Invalid request',
      message: error.message
    })
  };
}
```

### Lambda Errors

```javascript
function handleLambdaError(error) {
  logger.error('Lambda error:', error);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Internal server error',
      message: 'Error processing request'
    })
  };
}
```

### Format Errors

```javascript
function handleFormatError(error) {
  logger.error('Format error:', error);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Format error',
      message: 'Invalid favicon format'
    })
  };
}
```

## Troubleshooting

### Common Issues and Solutions

1. **Invalid Request Format**
   - **Symptom**: 400 Bad Request
   - **Verification**: Check request method and path
   - **Solution**: Ensure GET request to exact path "/favicon.ico"

2. **Module Loading Error**
   - **Symptom**: 500 Internal Server Error
   - **Verification**: Check Lambda logs for module errors
   - **Solution**: Verify favicon.js exists and exports FAVICON constant

3. **Invalid ICO Format**
   - **Symptom**: ICO verification fails
   - **Verification**: Save response and check with file command
   - **Solution**: Regenerate favicon using favicon generation process

### Verification Commands

```bash
# Full API test with debug output
node scripts/test-endpoints.js --favicon --log-level debug

# Check response headers
curl -I http://localhost:3000/favicon.ico

# Save and verify ICO format
curl http://localhost:3000/favicon.ico > test.ico
file test.ico

# Check binary content
xxd test.ico | head -n 1
# Expected: 0000000: 0000 0100 0300 0000 ...
```

## Dependencies

- Node.js 18+
- AWS Lambda runtime
- Winston logger for debug output
