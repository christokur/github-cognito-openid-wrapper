const axios = require('axios');
const logger = require('./test-logger');

async function testEndpoint(baseUrl, path, method = 'GET') {
  const url = `${baseUrl}${path}`;
  try {
    logger.debug(`Testing endpoint`, {
      prefix: 'HTTP',
      method,
      path
    });

    const response = await axios({
      method,
      url,
      validateStatus: null // Don't throw on any status code
    });

    logger.debug(`Received response`, {
      prefix: 'HTTP',
      method,
      path,
      status: response.status,
      statusText: response.statusText
    });

    return response;
  } catch (error) {
    if (error.response) {
      logger.debug(`Received error response`, {
        prefix: 'HTTP',
        method,
        path,
        status: error.response.status,
        statusText: error.response.statusText
      });
      return error.response;
    }

    logger.error(`Request failed`, {
      prefix: 'HTTP',
      method,
      path,
      error: error.message
    });
    throw error;
  }
}

async function discoverEndpoints(baseUrl) {
  logger.info(`Starting endpoint discovery`, {
    prefix: 'Discovery',
    url: `${baseUrl}/.well-known/openid-configuration`
  });

  try {
    const response = await testEndpoint(baseUrl, '/.well-known/openid-configuration');

    if (response.status !== 200) {
      logger.error(`OpenID configuration endpoint failed`, {
        prefix: 'Discovery',
        status: response.status
      });
      throw new Error(`OpenID configuration endpoint failed with status ${response.status}`);
    }

    if (!response.data || typeof response.data !== 'object') {
      logger.error(`OpenID configuration returned invalid JSON`, {
        prefix: 'Discovery'
      });
      throw new Error('OpenID configuration endpoint returned invalid JSON');
    }

    // Check for required endpoints
    const required = ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint'];
    const missing = required.filter(endpoint => !response.data[endpoint]);
    
    if (missing.length > 0) {
      logger.error(`OpenID configuration missing required endpoints`, {
        prefix: 'Discovery',
        missing
      });
      throw new Error(`OpenID configuration missing required endpoints: ${missing.join(', ')}`);
    }

    const endpoints = {
      authorization_endpoint: response.data.authorization_endpoint,
      token_endpoint: response.data.token_endpoint,
      userinfo_endpoint: response.data.userinfo_endpoint
    };

    logger.info(`Successfully discovered endpoints`, {
      prefix: 'Discovery',
      endpoints
    });

    return endpoints;
  } catch (error) {
    logger.error(`Failed to discover endpoints`, {
      prefix: 'Discovery',
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  testEndpoint,
  discoverEndpoints
};
