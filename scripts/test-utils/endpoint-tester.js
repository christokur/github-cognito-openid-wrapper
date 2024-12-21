const axios = require('axios');
const logger = require('./test-logger');
const querystring = require('querystring');

async function testEndpoint(baseUrl, path, method = 'GET', params = null, headers = null) {
  const url = `${baseUrl}${path}`;
  try {
    logger.debug(`Testing endpoint`, {
      prefix: 'HTTP',
      method,
      path,
      params,
      headers
    });

    const config = {
      method,
      url,
      validateStatus: null, // Don't throw on any status code
      maxRedirects: 0, // Don't follow redirects
      headers: headers || {}
    };

    // Add query parameters for GET requests
    if (method === 'GET' && params) {
      config.params = params;
    }
    
    // Add body parameters for POST requests
    if (method === 'POST' && params) {
      if (headers && headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        // For form-urlencoded, encode params as form data string
        config.data = querystring.stringify(params);
        logger.debug('Sending form-urlencoded data', {
          prefix: 'HTTP',
          data: config.data
        });
      } else if (headers && headers['Content-Type'] === 'application/json') {
        // For JSON, stringify the params
        const jsonData = JSON.stringify(params);
        config.data = jsonData;
        logger.debug('Sending JSON data', {
          prefix: 'HTTP',
          data: jsonData
        });
      } else {
        // Default to sending params as is
        config.data = params;
        logger.debug('Sending raw data', {
          prefix: 'HTTP',
          data: config.data
        });
      }
    }

    const response = await axios(config);

    logger.debug(`Received response`, {
      prefix: 'HTTP',
      method,
      path,
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });

    return response;
  } catch (error) {
    if (error.response) {
      logger.debug(`Received error response`, {
        prefix: 'HTTP',
        method,
        path,
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
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

    logger.info(`Successfully discovered endpoints`, {
      prefix: 'Discovery',
      endpoints: response.data
    });

    return response.data;
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
