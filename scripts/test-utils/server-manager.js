const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const logger = require('./test-logger');
const { SERVER_VERSION, startServer, PORT_NUMBER, killOrphanedServer } = require('../dev-oidc-server');

const execAsync = promisify(exec);
const EXPECTED_SERVER_VERSION = SERVER_VERSION;
let mockServer = null;

async function checkServerVersion(baseUrl) {
  try {
    const url = `http://localhost:${PORT_NUMBER}/version`;
    logger.debug(`Checking server version at ${url}`, {
      prefix: 'Server',
      expectedVersion: EXPECTED_SERVER_VERSION
    });
    const response = await axios.get(url);
    logger.debug(`Server version response`, {
      prefix: 'Server',
      version: response.data.version,
      expectedVersion: EXPECTED_SERVER_VERSION,
      match: response.data.version === EXPECTED_SERVER_VERSION
    });
    return { 
      running: true, 
      correctVersion: response.data.version === EXPECTED_SERVER_VERSION,
      version: response.data.version
    };
  } catch (error) {
    logger.debug(`Failed to check server version`, {
      prefix: 'Server',
      error: error.message,
      stack: error.stack
    });
    return { running: false, correctVersion: false };
  }
}

async function checkServerRunning(baseUrl, isLocalhost) {
  logger.info(`Checking server status`, {
    prefix: 'Server',
    baseUrl,
    isLocalhost
  });
  
  try {
    if (!isLocalhost) {
      logger.info(`Checking remote server`, {
        prefix: 'Server',
        url: baseUrl
      });
      await axios.get(`${baseUrl}/.well-known/openid-configuration`);
      logger.info(`Remote server is accessible`, {
        prefix: 'Server'
      });
      return { running: true, correctVersion: true };
    }

    logger.info(`Checking local server`, {
      prefix: 'Server'
    });
    const status = await checkServerVersion(baseUrl);
    
    if (status.running) {
      if (status.correctVersion) {
        logger.info(`Local server running with correct version`, {
          prefix: 'Server',
          version: status.version
        });
      } else {
        logger.warn(`Local server running with wrong version`, {
          prefix: 'Server',
          actual: status.version,
          expected: EXPECTED_SERVER_VERSION
        });
      }
    } else {
      logger.info(`Local server not running`, {
        prefix: 'Server'
      });
    }
    
    return status;
  } catch (error) {
    if (!isLocalhost) {
      logger.error(`Remote server not accessible`, {
        prefix: 'Server',
        url: baseUrl,
        error: error.message
      });
    } else {
      logger.info(`Local server not running`, {
        prefix: 'Server'
      });
    }
    return { running: false, correctVersion: false };
  }
}

async function startMockServer(baseUrl) {
  if (!baseUrl.includes('localhost')) {
    throw new Error('Cannot start mock server for non-localhost URL');
  }

  logger.info(`Starting mock OIDC server`, {
    prefix: 'Server'
  });

  // Kill any existing servers first
  await killOrphanedServer();
  
  mockServer = await startServer();

  logger.info(`Waiting for server to start`, {
    prefix: 'Server'
  });
  await new Promise(resolve => setTimeout(resolve, 1000));

  let retries = 5;
  while (retries > 0) {
    try {
      const status = await checkServerVersion(baseUrl);
      if (status.running && status.correctVersion) {
        logger.info(`Server started successfully`, {
          prefix: 'Server',
          version: status.version
        });
        return;
      }
      if (status.running && !status.correctVersion) {
        throw new Error(`Server started with wrong version: ${status.version}`);
      }
    } catch (error) {
      if (retries === 1) {
        logger.error(`Failed to start server`, {
          prefix: 'Server',
          error: error.message
        });
        throw new Error(`Failed to start mock server: ${error.message}`);
      }
      logger.info(`Retrying server start`, {
        prefix: 'Server',
        retriesRemaining: retries - 1
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    retries--;
  }
  
  throw new Error('Failed to start mock server with correct version after multiple attempts');
}

async function stopMockServer() {
  if (mockServer) {
    logger.info(`Stopping mock server`, {
      prefix: 'Server'
    });
    mockServer.close();
    mockServer = null;
    await killOrphanedServer();
    logger.info(`Server stopped`, {
      prefix: 'Server'
    });
  }
}

async function ensureServerRunning(baseUrl, isLocalhost) {
  const serverStatus = await checkServerRunning(baseUrl, isLocalhost);
  let serverStarted = false;
  
  if (!serverStatus.running) {
    if (!isLocalhost) {
      throw new Error(`Remote server at ${baseUrl} is not accessible`);
    }
    
    logger.info(`Mock server not running, starting it`, {
      prefix: 'Server'
    });
    await startMockServer(baseUrl);
    serverStarted = true;
  } else if (isLocalhost && !serverStatus.correctVersion) {
    logger.info(`Mock server running with wrong version, restarting`, {
      prefix: 'Server'
    });
    await startMockServer(baseUrl);
    serverStarted = true;
  }

  return serverStarted;
}

module.exports = {
  checkServerRunning,
  startMockServer,
  stopMockServer,
  ensureServerRunning,
  killOrphanedServer
};
