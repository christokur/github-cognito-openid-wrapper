#!/usr/bin/env node
const { exec } = require('child_process');
const { promisify } = require('util');
const express = require('express');

const execAsync = promisify(exec);

// Server version
const SERVER_VERSION = '0.3.2';

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
    clientContext: null
  };

  // Set environment variables for lambda handler
  process.env.GITHUB_CLIENT_ID = 'mock-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'mock-client-secret';
  process.env.COGNITO_REDIRECT_URI = 'http://localhost:3000/callback';
  process.env.GITHUB_API_URL = 'http://localhost:3000/github-api';
  process.env.GITHUB_LOGIN_URL = 'http://localhost:3000/github';

  lambda.handler(event, mockContext, (error, result) => {
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
      res.send(result.body);
    } else {
      res.end();
    }
  });
};

// Mock GitHub API responses
const mockGitHubResponses = {
  accessToken: {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    scope: 'user:email'
  },
  user: {
    id: 12345,
    login: 'test-user',
    name: 'Test User',
    email: 'test@example.com'
  },
  emails: [
    {
      email: 'test@example.com',
      primary: true,
      verified: true
    }
  ]
};

// Mock GitHub API endpoints
app.post('/github/login/oauth/access_token', (req, res) => {
  logger.debug('Mock GitHub token endpoint called', { body: req.body });
  res.json(mockGitHubResponses.accessToken);
});

app.get('/github-api/user', (req, res) => {
  logger.debug('Mock GitHub user endpoint called');
  res.json(mockGitHubResponses.user);
});

app.get('/github-api/user/emails', (req, res) => {
  logger.debug('Mock GitHub emails endpoint called');
  res.json(mockGitHubResponses.emails);
});

// OIDC endpoints (handled by Lambda)
app.all('/token', lambdaToExpress);
app.all('/authorize', lambdaToExpress);
app.all('/userinfo', lambdaToExpress);
app.all('/jwks', lambdaToExpress);
app.all('/.well-known/openid-configuration', lambdaToExpress);

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
  killOrphanedServer
};
