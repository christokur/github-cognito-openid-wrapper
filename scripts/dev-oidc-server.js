#!/usr/bin/env node
const { exec } = require('child_process');
const { promisify } = require('util');
const express = require('express');

const execAsync = promisify(exec);

// Server version
const SERVER_VERSION = '0.3.5';

// Parse command line arguments
const args = process.argv.slice(2);
let LOG_LEVEL = 'info'; // default log level

// Handle --log-level argument
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--log-level' && i + 1 < args.length) {
    LOG_LEVEL = args[i + 1].toLowerCase();
    break;
  }
}

const PORT_NUMBER = process.env.PORT || 3000;

// Set environment variables before requiring any modules
process.env.LOG_LEVEL = LOG_LEVEL;
process.env.GITHUB_CLIENT_ID = 'mock-client-id';
process.env.GITHUB_CLIENT_SECRET = 'mock-client-secret';
process.env.COGNITO_REDIRECT_URI = 'http://localhost:3000/callback';
process.env.GITHUB_API_URL = 'http://localhost:3000/github-api'; // Use mock GitHub API
process.env.GITHUB_LOGIN_URL = 'http://localhost:3000/github'; // Use mock GitHub endpoint

const githubApiMock = require('./test-utils/github-api-mock');
const logger = require('../src/connectors/logger');
const lambda = require('../src/connectors/lambda');

const app = express();

async function killOrphanedServer() {
  try {
    // Find any node processes listening on port PORT_NUMBER
    const { stdout } = await execAsync(`lsof -i :${PORT_NUMBER} -t`);
    if (stdout) {
      const pids = stdout.trim().split('\n');
      logger.info(`Found orphaned server processes`, {
        prefix: 'Cleanup',
        pids
      });

      // Kill each process
      for (const pid of pids) {
        await execAsync(`kill -9 ${pid}`);
        logger.info(`Killed process`, {
          prefix: 'Cleanup',
          pid
        });
      }
      // Wait for processes to fully terminate
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    // If lsof fails, likely no processes found
    logger.debug(`No orphaned processes found`, {
      prefix: 'Cleanup'
    });
  }
}

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS headers
app.use((req, res, next) => {
  logger.debug({
    message: 'Received request',
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Parse JSON for POST/PUT/PATCH requests
const jsonParser = express.json();
app.post('*', jsonParser);
app.put('*', jsonParser);
app.patch('*', jsonParser);

// Version endpoint (only available on mock server)
app.get('/version', (req, res) => {
  res.json({ version: SERVER_VERSION });
});

// Lambda handler adapter
const lambdaToExpress = (req, res) => {
  const callback = (error, result) => {
    if (error) {
      logger.error('Lambda handler error', { error: error.message });
      res.status(500).json({
        error: 'server_error',
        error_description: error.message
      });
      return;
    }

    if (!result) {
      logger.error('No response from handler');
      res.status(500).json({
        error: 'server_error',
        error_description: 'No response from handler'
      });
      return;
    }

    res.status(result.statusCode);
    Object.entries(result.headers || {}).forEach(([key, value]) => {
      res.header(key, value);
    });

    if (result.body) {
      if (LOG_LEVEL === 'debug') {
        logger.debug('Mock server sending response', {
          isBase64Encoded: result.isBase64Encoded,
          bodyLength: result.body.length,
          bodyType: typeof result.body,
          firstBytes: result.isBase64Encoded ? Buffer.from(result.body, 'base64').slice(0, 4) : null
        });
      }
      if (result.isBase64Encoded) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(Buffer.from(result.body, 'base64'));
      } else {
        res.send(result.body);
      }
    } else {
      res.end();
    }
  };
  const event = {
    path: req.path,
    httpMethod: req.method,
    headers: {
      ...req.headers,
      Host: `${req.protocol}://${req.get('host')}`
    },
    queryStringParameters: req.query,
    body: req.headers['content-type']?.startsWith('application/json') ? JSON.stringify(req.body) : req.body
  };
  // Create mock AWS Lambda context
  const mockContext = {
    awsRequestId: 'mock-request-' + Date.now(),
    functionName: 'mock-oidc-server',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'mock-arn',
    memoryLimitInMB: '128',
    logGroupName: '/mock/lambda/log-group',
    logStreamName: 'mock-log-stream',
    identity: null,
    clientContext: null,
    getRemainingTimeInMillis: () => 300000 // 5 minutes in milliseconds
  };

  // Create mock event with headers
  const mockEvent = {
    ...event,
    headers: {
      ...event.headers,
      Host: `localhost:${PORT_NUMBER}`
    }
  };

  // Set environment variables for lambda handler
  process.env.GITHUB_CLIENT_ID = 'mock-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'mock-client-secret';
  process.env.COGNITO_REDIRECT_URI = 'http://localhost:3000/callback';
  process.env.GITHUB_API_URL = 'http://localhost:3000/github-api';
  process.env.GITHUB_LOGIN_URL = 'http://localhost:3000/github';

  lambda.handler(mockEvent, mockContext, callback);
};

// Mock GitHub API endpoints
app.post('/github/login/oauth/access_token', async (req, res) => {
  logger.debug('Mock GitHub token endpoint called', { body: req.body });
  
  try {
    const mockAxios = githubApiMock.getAxios();
    const response = await mockAxios.post('/login/oauth/access_token', req.body);
    
    // GitHub returns form-urlencoded response
    res.set('Content-Type', 'application/x-www-form-urlencoded');
    res.send(`access_token=${response.data.access_token}&token_type=${response.data.token_type}&scope=${response.data.scope}`);
  } catch (error) {
    logger.error('Mock GitHub token error', { error: error.message });
    res.status(error.response?.status || 500).json(error.response?.data || {
      error: 'server_error',
      error_description: error.message
    });
  }
});

// Mock GitHub API user endpoints
app.get('/github-api/user', async (req, res) => {
  logger.debug('Mock GitHub user endpoint called', { headers: req.headers });

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'No valid access token provided'
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== 'mock-access-token') {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Invalid access token'
    });
  }

  try {
    const mockAxios = githubApiMock.getAxios();
    const response = await mockAxios.get('/user', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    res.json(response.data);
  } catch (error) {
    logger.error('Mock GitHub user error', { error: error.message });
    res.status(error.response?.status || 500).json(error.response?.data || {
      error: 'server_error',
      error_description: error.message
    });
  }
});

app.get('/github-api/user/emails', async (req, res) => {
  logger.debug('Mock GitHub user emails endpoint called', { headers: req.headers });

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'No valid access token provided'
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== 'mock-access-token') {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Invalid access token'
    });
  }

  try {
    const mockAxios = githubApiMock.getAxios();
    const response = await mockAxios.get('/user/emails', {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error) {
    logger.error('Mock GitHub emails error', { error: error.message });
    res.status(error.response?.status || 500).json(error.response?.data || {
      error: 'server_error',
      error_description: error.message
    });
  }
});

// Mock GitHub OAuth login page
app.get('/github/login/oauth/authorize', (req, res) => {
  logger.debug('Mock GitHub authorize endpoint called', { query: req.query });
  
  // Validate required parameters
  const requiredParams = ['client_id', 'scope', 'state'];
  const missingParams = requiredParams.filter(param => !req.query[param]);
  
  if (missingParams.length > 0) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: `Missing required parameters: ${missingParams.join(', ')}`
    });
  }

  // Auto-approve and redirect back with code
  const code = 'mock-auth-code-' + Date.now();
  const redirectUri = req.query.redirect_uri || process.env.COGNITO_REDIRECT_URI;
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', req.query.state);
  
  logger.debug('Redirecting to callback', { redirectUrl: redirectUrl.toString() });
  res.redirect(redirectUrl.toString());
});

// OIDC endpoints (handled by Lambda)
app.all('/token', lambdaToExpress);
app.all('/authorize', lambdaToExpress);
app.all('/userinfo', lambdaToExpress);
app.all('/jwks', lambdaToExpress);
app.all('/.well-known/openid-configuration', lambdaToExpress);
app.all('/favicon.ico', lambdaToExpress);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Server error', {
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({
    error: 'server_error',
    error_description: err.message
  });
});

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT_NUMBER)
      .on('listening', () => {
        logger.info(`Mock OIDC server started on port ${PORT_NUMBER} with log level ${LOG_LEVEL}`);
        logger.debug('Debug logging enabled');
        resolve(server);
      })
      .on('error', async (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.info('Port in use, attempting to kill orphaned server');
          try {
            await killOrphanedServer();
            // Retry starting the server
            const retryServer = app.listen(PORT_NUMBER)
              .on('listening', () => {
                logger.info(`Mock OIDC server started on port ${PORT_NUMBER} with log level ${LOG_LEVEL}`);
                logger.debug('Debug logging enabled');
                resolve(retryServer);
              })
              .on('error', (retryError) => {
                reject(retryError);
              });
          } catch (cleanupError) {
            reject(cleanupError);
          }
        } else {
          reject(error);
        }
      });
  });
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
}

// Export configuration and utilities for other modules
module.exports = {
  SERVER_VERSION,
  app,
  PORT_NUMBER,
  killOrphanedServer,
  startServer
};
