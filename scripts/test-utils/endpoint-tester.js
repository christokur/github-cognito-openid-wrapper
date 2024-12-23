const axios = require('axios');
const logger = require('./test-logger');
const querystring = require('querystring');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { verifyIco } = require('../../src/utils/favicon-verifier');

function isValidICOFormat(data) {
  return verifyIco(data);
}

async function testEndpoint(baseUrl, urlPath, method = 'GET', params = null, headers = null, options = {}) {
  const url = baseUrl.endsWith('/') ? `${baseUrl.slice(0, -1)}${urlPath}` : `${baseUrl}${urlPath}`;
  try {
    logger.debug(`Testing endpoint`, {
      prefix: 'HTTP',
      method,
      path: urlPath,
      url,
      params,
      headers
    });

    const config = {
      method,
      url,
      validateStatus: null, // Don't throw on any status code
      maxRedirects: 0, // Don't follow redirects
      headers: headers || {},
      responseType: urlPath === '/favicon.ico' ? 'arraybuffer' : 'json'  // Get binary for favicon, JSON for others
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

    // For favicon, analyze the response
    if (urlPath === '/favicon.ico' && response.status === 200) {
      const tempPath = path.join(os.tmpdir(), 'favicon.ico');
      fs.writeFileSync(tempPath, response.data);
      logger.result(' Favicon saved to: ' + tempPath);

      // Only preview if openIco option is set and it's a valid ICO
      if (isValidICOFormat(response.data) && options.openIco) {
        try {
          if (process.platform === 'darwin') {
            execSync(`open ${tempPath}`);
          }
        } catch (e) {
          logger.warn('Could not open image viewer', { error: e.message });
        }
      }
    }

    logger.debug(`Received response`, {
      prefix: 'HTTP',
      method,
      path: urlPath,
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });

    if (urlPath === '/favicon.ico') {
      const faviconPath = path.join(os.tmpdir(), 'favicon.ico');
      fs.writeFileSync(faviconPath, response.data);
      
      logger.debug('Response data for favicon', {
        dataType: typeof response.data,
        isBuffer: Buffer.isBuffer(response.data),
        length: response.data.length,
        firstBytes: Buffer.isBuffer(response.data) ? response.data.slice(0, 4) : null
      });

      return {
        response,
        analysis: {
          contentType: response.headers['content-type'],
          size: response.data.length,
          base64: response.data.toString('base64'),
          path: faviconPath,
          isValidICO: isValidICOFormat(response.data),
          cacheControl: response.headers['cache-control'],
          requestId: response.headers['x-amzn-requestid'],
          traceId: response.headers['x-amzn-trace-id']
        }
      };
    }

    return { response };
  } catch (error) {
    logger.error('Request failed', {
      prefix: 'HTTP',
      error: error.message,
      url,
      method,
      params
    });
    throw error;
  }
}

async function testFavicon(baseUrl, options = {}) {
  return testEndpoint(baseUrl, '/favicon.ico', 'GET', null, null, options);
}

async function discoverEndpoints(baseUrl) {
  const { response } = await testEndpoint(baseUrl, '/.well-known/openid-configuration');
  return response.data;
}

module.exports = {
  testEndpoint,
  testFavicon,
  discoverEndpoints
};
