#!/usr/bin/env node
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

// Set log level from CLI argument or default to 'info'
const validLogLevels = ['error', 'warn', 'info', 'debug'];

// Parse command line arguments
const argv = require('minimist')(process.argv.slice(2), {
  string: ['url', 'log-level'],
  default: {
    url: 'http://localhost:3000',
    'log-level': 'info'
  }
});

process.env.LOG_LEVEL = argv['log-level'];
const logger = require('../src/connectors/logger');

const baseUrl = argv.url;
const isLocalhost = baseUrl.includes('localhost');
let mockServer = null;

// Expected version of the mock server
const EXPECTED_SERVER_VERSION = '0.1.0';

async function checkServerVersion() {
  try {
    // Only check version for localhost
    if (!isLocalhost) {
      return { running: true, correctVersion: true };
    }
    const response = await axios.get(`${baseUrl}/version`);
    return { 
      running: true, 
      correctVersion: response.data.version === EXPECTED_SERVER_VERSION,
      version: response.data.version
    };
  } catch (error) {
    // For remote URLs, ignore version check failures
    if (!isLocalhost) {
      return { running: true, correctVersion: true };
    }
    return { running: false, correctVersion: false };
  }
}

async function checkServerRunning() {
  try {
    // For remote URLs, just check if OpenID configuration is accessible
    if (!isLocalhost) {
      await axios.get(`${baseUrl}/.well-known/openid-configuration`);
      return { running: true, correctVersion: true };
    }
    
    // For localhost, check if server is running with correct version
    return await checkServerVersion();
  } catch (error) {
    return { running: false, correctVersion: false };
  }
}

async function startMockServer() {
  if (!isLocalhost) {
    throw new Error('Cannot start mock server for non-localhost URL');
  }

  console.log('\n=== Starting Mock OIDC Server ===\n');
  
  // Kill existing server if running
  if (mockServer) {
    mockServer.kill();
    mockServer = null;
  }
  
  // Wait for port to be released
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const serverPath = path.join(__dirname, 'mock-oidc-server.js');
  mockServer = spawn('node', [serverPath, process.env.LOG_LEVEL], {
    stdio: 'inherit',  // Show server output directly in console
    detached: false,
    env: { ...process.env }
  });

  // Give the server a moment to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if server starts successfully with correct version
  let retries = 5;
  while (retries > 0) {
    try {
      const status = await checkServerVersion();
      if (status.running && status.correctVersion) {
        return;
      }
      if (status.running && !status.correctVersion) {
        throw new Error(`Server started with wrong version: ${status.version}`);
      }
    } catch (error) {
      if (retries === 1) {
        throw new Error(`Failed to start mock server: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    retries--;
  }
  
  throw new Error('Failed to start mock server with correct version after multiple attempts');
}

async function stopMockServer() {
  if (mockServer) {
    mockServer.kill();
    mockServer = null;
  }
}

async function testEndpoint(path, method = 'GET', data = null, headers = null, endpoint = null) {
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
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      validateStatus: null // Don't throw on any status code
    });

    // Log response details
    logger.info({
      message: `[Test] ${method} ${path}`,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    });

    // Run custom validation if provided
    if (endpoint?.validate && response.status === 200) {
      try {
        endpoint.validate(response);
      } catch (error) {
        logger.error({
          message: `[Test] Validation failed for ${endpoint.name}`,
          error: error.message
        });
        throw error;
      }
    }

    // Validate CORS headers
    const corsHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Headers'
    ];
    corsHeaders.forEach(header => {
      if (!response.headers[header.toLowerCase()]) {
        logger.warn({
          message: `[Test] Missing CORS header: ${header}`,
          path,
          method
        });
      }
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
    baseUrl,
    isLocalhost
  });

  let serverStarted = false;
  try {
    const serverStatus = await checkServerRunning();
    
    if (!serverStatus.running) {
      if (!isLocalhost) {
        throw new Error(`Remote server at ${baseUrl} is not accessible`);
      }
      
      logger.info({
        message: '[Test] Mock server not running, starting it...'
      });
      
      await startMockServer();
      serverStarted = true;
      logger.info({
        message: '[Test] Mock server started successfully'
      });
    } else if (isLocalhost && !serverStatus.correctVersion) {
      logger.info({
        message: `[Test] Mock server running with wrong version (${serverStatus.version}), restarting with correct version (${EXPECTED_SERVER_VERSION})...`
      });
      
      await startMockServer();
      serverStarted = true;
      logger.info({
        message: '[Test] Mock server restarted successfully'
      });
    }

    // Test OpenID configuration endpoint first to discover other endpoints
    const configEndpoint = {
      name: 'OpenID Configuration',
      url: '/.well-known/openid-configuration',
      method: 'GET',
      expectedStatus: [200],
      validate: (response) => {
        // Required fields per OpenID Connect spec
        const required = [
          'issuer',
          'authorization_endpoint',
          'token_endpoint',
          'jwks_uri',
          'response_types_supported',
          'subject_types_supported',
          'id_token_signing_alg_values_supported'
        ];
        const missing = required.filter(field => !response.data[field]);
        if (missing.length > 0) {
          throw new Error(`OpenID configuration missing required fields: ${missing.join(', ')}`);
        }

        // Validate issuer URL format (allow http for localhost)
        if (!response.data.issuer.startsWith('http://') && !response.data.issuer.startsWith('https://')) {
          throw new Error('Issuer URL must use HTTP or HTTPS');
        }
        if (!response.data.issuer.includes('localhost') && !response.data.issuer.startsWith('https://')) {
          throw new Error('Issuer URL must use HTTPS for non-localhost environments');
        }

        // Validate supported response types
        if (!response.data.response_types_supported.includes('code')) {
          throw new Error('OpenID configuration must support "code" response type');
        }

        // Validate supported scopes
        if (!response.data.scopes_supported?.includes('openid')) {
          throw new Error('OpenID configuration must support "openid" scope');
        }

        // Validate subject types
        if (!response.data.subject_types_supported?.includes('public')) {
          throw new Error('OpenID configuration must support "public" subject type');
        }

        // Validate signing algorithms
        if (!response.data.id_token_signing_alg_values_supported?.includes('RS256')) {
          throw new Error('OpenID configuration must support RS256 signing algorithm');
        }

        // Log supported features
        logger.debug({
          message: '[Test] OpenID configuration supported features',
          response_types: response.data.response_types_supported,
          scopes: response.data.scopes_supported,
          subject_types: response.data.subject_types_supported,
          id_token_algs: response.data.id_token_signing_alg_values_supported
        });
      }
    };

    let config;
    try {
      const configResponse = await testEndpoint(
        configEndpoint.url,
        configEndpoint.method,
        null,
        null,
        configEndpoint
      );

      if (configResponse.status !== 200) {
        throw new Error(`OpenID configuration endpoint failed with status ${configResponse.status}`);
      }

      if (!configResponse.data || typeof configResponse.data !== 'object') {
        throw new Error('OpenID configuration endpoint returned invalid JSON');
      }

      config = configResponse.data;
    } catch (error) {
      logger.error({
        message: '[Test] Failed to fetch OpenID configuration',
        error: error.message
      });
      // Use default endpoints for testing if configuration fails
      config = {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        userinfo_endpoint: `${baseUrl}/userinfo`,
        jwks_uri: `${baseUrl}/.well-known/jwks.json`
      };
      logger.warn({
        message: '[Test] Using default endpoints',
        endpoints: config
      });
    }
    logger.info({
      message: '[Test] Discovered endpoints',
      endpoints: config
    });

    // Test each discovered endpoint
    const endpoints = [
      // Test JWKS endpoint
      {
        name: 'JWKS',
        url: config.jwks_uri,
        method: 'GET',
        expectedStatus: [200],
        validate: (response) => {
          if (!response.data.keys || !Array.isArray(response.data.keys)) {
            throw new Error('Invalid JWKS response format: missing or invalid keys array');
          }
          if (!response.data.keys.every(key => key.kty && key.kid && key.n && key.e)) {
            throw new Error('Invalid JWKS key format: missing required RSA key parameters');
          }
        }
      },
      // Test Authorization endpoint - success case
      {
        name: 'Authorization (valid)',
        url: config.authorization_endpoint,
        method: 'GET',
        params: {
          response_type: 'code',
          client_id: 'test_client',
          redirect_uri: 'http://localhost:3000/callback',
          scope: 'openid profile email',
          state: 'test_state',
          nonce: 'test_nonce'
        },
        expectedStatus: [200, 302]
      },
      // Test Authorization endpoint - missing parameters
      {
        name: 'Authorization (invalid)',
        url: config.authorization_endpoint,
        method: 'GET',
        params: {
          response_type: 'code'
        },
        expectedStatus: [400]
      },
      // Test Token endpoint - authorization_code grant
      {
        name: 'Token (authorization_code)',
        url: config.token_endpoint,
        method: 'POST',
        data: {
          grant_type: 'authorization_code',
          code: 'test_code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test_client',
          code_verifier: 'test_verifier',
          state: 'test_state'
        },
        expectedStatus: [200, 400],
        validate: (response) => {
          if (response.status === 200) {
            const required = ['access_token', 'token_type', 'expires_in'];
            const missing = required.filter(field => !response.data[field]);
            if (missing.length > 0) {
              throw new Error(`Token response missing required fields: ${missing.join(', ')}`);
            }
            if (response.data.token_type.toLowerCase() !== 'bearer') {
              throw new Error('Token response must have token_type "Bearer"');
            }
            if (typeof response.data.expires_in !== 'number') {
              throw new Error('Token response expires_in must be a number');
            }
          }
        }
      },
      // Test Token endpoint - missing parameters
      {
        name: 'Token (invalid)',
        url: config.token_endpoint,
        method: 'POST',
        data: {
          grant_type: 'authorization_code'
        },
        expectedStatus: [400]
      },
      // Test Token endpoint - wrong HTTP method
      {
        name: 'Token (wrong method)',
        url: config.token_endpoint,
        method: 'GET',
        expectedStatus: [405]
      },
      // Test UserInfo endpoint - with token
      {
        name: 'UserInfo (with token)',
        url: config.userinfo_endpoint,
        method: 'GET',
        headers: {
          Authorization: 'Bearer test_token'
        },
        expectedStatus: [200, 400, 401],
        validate: (response) => {
          if (response.status === 200) {
            const required = ['sub'];  // 'sub' is the only required claim per OIDC spec
            const optional = ['name', 'email', 'email_verified', 'profile', 'picture'];
            
            const missing = required.filter(field => !response.data[field]);
            if (missing.length > 0) {
              throw new Error(`UserInfo response missing required claims: ${missing.join(', ')}`);
            }

            // Log which optional claims are present
            const present = optional.filter(field => response.data[field]);
            logger.debug({
              message: '[Test] UserInfo optional claims present',
              claims: present
            });

            // Validate email format if present
            if (response.data.email && !response.data.email.includes('@')) {
              throw new Error('UserInfo email claim must be a valid email address');
            }

            // Validate email_verified is boolean if present
            if ('email_verified' in response.data && typeof response.data.email_verified !== 'boolean') {
              throw new Error('UserInfo email_verified claim must be a boolean');
            }
          }
        }
      },
      // Test UserInfo endpoint - without token
      {
        name: 'UserInfo (without token)',
        url: config.userinfo_endpoint,
        method: 'GET',
        expectedStatus: [401]
      },
      // Test UserInfo endpoint - wrong HTTP method
      {
        name: 'UserInfo (wrong method)',
        url: config.userinfo_endpoint,
        method: 'POST',
        expectedStatus: [405]
      }
    ];

    // Test each endpoint
    for (const endpoint of endpoints) {
      logger.info({
        message: `[Test] Testing ${endpoint.name} endpoint`,
        url: endpoint.url,
        method: endpoint.method
      });

      let url = endpoint.url;
      if (endpoint.params) {
        const params = new URLSearchParams(endpoint.params);
        url = `${url}?${params.toString()}`;
      }

      const response = await testEndpoint(
        url.replace(baseUrl, ''), // Remove base URL if it's included
        endpoint.method,
        endpoint.data,
        endpoint.headers,
        endpoint
      );

      if (!endpoint.expectedStatus.includes(response.status)) {
        throw new Error(`${endpoint.name} endpoint failed: got status ${response.status}, expected one of ${endpoint.expectedStatus.join(', ')}`);
      }

      logger.info({
        message: `[Test] ${endpoint.name} endpoint test completed`,
        status: response.status,
        data: response.data
      });
    }

    logger.info({
      message: '[Test] All endpoint tests completed successfully'
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
  if (argv.h || argv.help) {
    console.log(`
Usage: ./test-endpoints.js [options]

Options:
  --url        Base URL of the API to test (default: http://localhost:3000)
  --log-level  One of: ${validLogLevels.join(', ')} (default: info)
  -h, --help   Show this help message

Examples:
  ./test-endpoints.js --url https://api.example.com  # Test production API
  ./test-endpoints.js --log-level debug             # Test local API with debug logging
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
