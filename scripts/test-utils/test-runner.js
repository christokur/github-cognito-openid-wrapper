const logger = require('./test-logger');
const { ensureServerRunning, stopMockServer } = require('./server-manager');
const { testEndpoint, discoverEndpoints } = require('./endpoint-tester');
const { getTestDefinitions } = require('./test-definitions');

async function runTests(baseUrl, isLocalhost) {
  logger.section('Running OIDC Endpoint Tests');
  
  logger.info('Starting endpoint tests', {
    prefix: 'Config',
    baseUrl,
    isLocalhost,
    logLevel: process.env.LOG_LEVEL
  });

  let serverStarted = false;
  let results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  try {
    // Step 1: Ensure server is running
    serverStarted = await ensureServerRunning(baseUrl, isLocalhost);
    
    // Step 2: Discover endpoints
    const config = await discoverEndpoints(baseUrl);

    // Display discovered endpoints
    logger.section('Discovered Endpoints');
    const endpointFields = ['issuer', 'authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'jwks_uri'];
    endpointFields.forEach(field => {
      if (config[field]) {
        logger.result(`${field}: ${config[field]}`);
      }
    });
    logger.result(''); // Empty line for readability

    // Step 3: Get test definitions
    const endpoints = getTestDefinitions(config);
    results.total = endpoints.length;

    logger.section('Testing HTTP Methods');

    // Step 4: Run tests for each endpoint
    for (const endpoint of endpoints) {
      const path = endpoint.url.replace(baseUrl, '');
      logger.info(`Testing endpoint`, {
        prefix: 'Test',
        method: endpoint.method,
        path,
        expectedStatus: endpoint.expectedStatus
      });

      try {
        const response = await testEndpoint(
          baseUrl,
          path,
          endpoint.method,
          endpoint.params,
          endpoint.headers
        );

        if (response.status === endpoint.expectedStatus) {
          results.passed++;
          logger.info(`Test passed`, {
            prefix: 'Test',
            method: endpoint.method,
            path,
            status: response.status
          });
        } else {
          results.failed++;
          const error = `Result: status ${response.status}, expected ${endpoint.expectedStatus}`;
          results.failures.push({
            endpoint: path,
            method: endpoint.method,
            name: endpoint.name,
            error,
            expected: endpoint.expectedStatus,
            actual: response.status
          });
          logger.error(`Test failed`, {
            prefix: 'Test',
            method: endpoint.method,
            path,
            error,
            expected: endpoint.expectedStatus,
            actual: response.status
          });
        }
      } catch (error) {
        results.failed++;
        results.failures.push({
          endpoint: path,
          method: endpoint.method,
          error: error.message,
          name: endpoint.name
        });
        logger.error(`Test failed`, {
          prefix: 'Test',
          method: endpoint.method,
          path,
          error: error.message
        });
      }
    }

    // Step 5: Print test summary
    logger.section('Test Summary');
    logger.result(`Total Tests: ${results.total}`);
    logger.result(`Passed: ${results.passed}`);
    logger.result(`Failed: ${results.failed}`);
    
    if (results.failures.length > 0) {
      logger.result('\nFailures:');
      results.failures.forEach(failure => {
        logger.result(`✗ ${failure.method} ${failure.endpoint}`);
        logger.result(`  ${failure.name}`);
        logger.result(`  ${failure.error}`);
      });
    }
    logger.result(''); // Empty line for readability

    logger.info('Test suite completed', {
      prefix: 'Summary',
      total: results.total,
      passed: results.passed,
      failed: results.failed
    });

    // Exit with error if any tests failed
    if (results.failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    logger.error('Test suite failed', {
      prefix: 'Error',
      error: error.message
    });
    process.exit(1);
  } finally {
    // Step 6: Cleanup
    if (serverStarted) {
      await stopMockServer();
    }
  }

  return results;
}

module.exports = {
  runTests
};
