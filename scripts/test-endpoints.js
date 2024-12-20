#!/usr/bin/env node
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

// Set log level from CLI argument or default to 'info'
const args = process.argv.slice(2);
const validLogLevels = ['error', 'warn', 'info', 'debug'];
process.env.LOG_LEVEL = args[0]?.toLowerCase() || 'info';

const logger = require('../src/connectors/logger');

// Get base URL from environment or use default
const baseUrl = process.env.API_URL || 'http://localhost:3000';
let mockServer = null;

async function checkServerRunning() {
  try {
    await axios.get(`${baseUrl}/.well-known/openid-configuration`);
    return true;
  } catch (error) {
    return false;
  }
}

async function startMockServer() {
  return new Promise((resolve, reject) => {
    console.log('\n=== Starting Mock OIDC Server ===\n');
    
    const serverPath = path.join(__dirname, 'mock-oidc-server.js');
    mockServer = spawn('node', [serverPath, process.env.LOG_LEVEL], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env }
    });

    let serverOutput = '';
    mockServer.stdout.on('data', (data) => {
      serverOutput += data;
      process.stdout.write(data);
    });

    mockServer.stderr.on('data', (data) => {
      serverOutput += data;
      process.stderr.write(data);
    });

    // Check if server starts successfully
    const checkInterval = setInterval(async () => {
      if (await checkServerRunning()) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`Server failed to start. Output: ${serverOutput}`));
    }, 10000);

    mockServer.on('error', (error) => {
      clearInterval(checkInterval);
      reject(error);
    });
  });
}

async function stopMockServer() {
  if (mockServer) {
    mockServer.kill();
    mockServer = null;
  }
}

async function testEndpoint(path, method = 'GET', data = null, headers = null) {
  const url = `${baseUrl}${path}`;
  try {
    logger.debug({
      message: `[Test] Testing endpoint`,
      method,
      url,
      data,
      headers
    });

    const response = await axios({
      method,
      url,
      data,
      headers,
      validateStatus: null // Don't throw on any status code
    });

    logger.info({
      message: `[Test] ${method} ${path}`,
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });

    return response;
  } catch (error) {
    logger.error({
      message: `[Test] Failed to test endpoint`,
      method,
      url,
      error: error.message,
      ...(error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : {})
    });
    throw error;
  }
}

async function runTests() {
  console.log('\n=== Running OIDC Endpoint Tests ===\n');
  
  logger.info({
    message: '[Test] Starting endpoint tests',
    baseUrl
  });

  let serverStarted = false;
  try {
    // Check if server is running
    const isRunning = await checkServerRunning();
    if (!isRunning) {
      logger.info({
        message: '[Test] Mock server not running, starting it...'
      });
      await startMockServer();
      serverStarted = true;
      logger.info({
        message: '[Test] Mock server started successfully'
      });
    }

    // Test OpenID configuration endpoint
    await testEndpoint('/.well-known/openid-configuration');

    // Test JWKS endpoint
    await testEndpoint('/jwks');

    // Test authorization endpoint with required parameters
    await testEndpoint('/authorize?response_type=code&client_id=test_client&redirect_uri=http://localhost:3000/callback&scope=openid%20profile%20email&state=test_state');

    // Test token endpoint with sample data
    const tokenResponse = await testEndpoint('/token', 'POST', {
      grant_type: 'authorization_code',
      code: 'test_code',
      redirect_uri: 'http://localhost:3000/callback',
      client_id: 'test_client'
    });

    // Test userinfo endpoint with token
    await testEndpoint('/userinfo', 'GET', null, {
      Authorization: `Bearer ${tokenResponse.data.access_token}`
    });

    logger.info({
      message: '[Test] All endpoint tests completed'
    });
  } catch (error) {
    logger.error({
      message: '[Test] Test suite failed',
      error: error.message
    });
    process.exit(1);
  } finally {
    // Stop the mock server if we started it
    if (serverStarted) {
      await stopMockServer();
      logger.info({
        message: '[Test] Mock server stopped'
      });
    }
  }
}

if (require.main === module) {
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage: ./test-endpoints.js [log_level]

Environment Variables:
  API_URL     Base URL of the API to test (default: http://localhost:3000)

Arguments:
  log_level   Optional. One of: ${validLogLevels.join(', ')}
              Defaults to 'info' if not specified

Examples:
  API_URL=https://api.example.com ./test-endpoints.js        # Test production API
  ./test-endpoints.js debug                                  # Test local API with debug logging
  `);
    process.exit(0);
  }

  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    await stopMockServer();
    process.exit();
  });

  runTests();
}

module.exports = {
  testEndpoint,
  runTests
};
