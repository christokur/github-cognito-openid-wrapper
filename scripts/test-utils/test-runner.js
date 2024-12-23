const logger = require('./test-logger');
const { ensureServerRunning, stopMockServer } = require('./server-manager');
const { testEndpoint, testFavicon, discoverEndpoints } = require('./endpoint-tester');
const { getTestDefinitions } = require('./test-definitions');

function displayFaviconReport(analysis) {
  console.log('\n=== Favicon Report ===');
  console.log('Content Type:', analysis.contentType);
  console.log('Size:', analysis.size, 'bytes');
  console.log('Base64 Payload:', analysis.base64);
  console.log('Saved to:', analysis.path);
  console.log('Valid ICO Format:', analysis.isValidICO ? '✓ Yes' : '✗ No');
  console.log('Cache Control:', analysis.cacheControl || 'Not set');
  if (analysis.requestId) {
    console.log('Request ID:', analysis.requestId);
  }
  if (analysis.traceId) {
    console.log('X-Amzn-Trace-Id:', analysis.traceId);
  }
  console.log('===================\n');
}

async function runTests(baseUrl, isLocalhost, options = {}) {
  logger.section('Running OIDC Endpoint Tests');
  
  logger.info('Starting endpoint tests', {
    prefix: 'Config',
    baseUrl,
    isLocalhost,
    logLevel: process.env.LOG_LEVEL,
    testFilters: options.testFilters || []
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
    
    // Step 3: Run endpoint tests if not favicon-only mode
    if (!options.favicon) {
      // Discover endpoints
      const endpoints = await discoverEndpoints(baseUrl);
      
      // Add isLocalhost flag to endpoints config
      endpoints.isLocalhost = isLocalhost;
      
      // Get test definitions
      const tests = getTestDefinitions(endpoints);

      // Filter tests if test filters are provided
      const testsToRun = options.testFilters && options.testFilters.length > 0
        ? tests.filter(test => 
            options.testFilters.some(filter => 
              test.name.toLowerCase().includes(filter.toLowerCase())
            )
          )
        : tests;

      logger.info(`Running ${testsToRun.length} tests`, {
        prefix: 'Config',
        totalTests: tests.length,
        filteredTests: testsToRun.length,
        filters: options.testFilters || []
      });

      // Run all tests in sequence
      for (const test of testsToRun) {
        console.log(`\n>>> Running Test: ${test.name} <<<`);
        logger.info(`Testing endpoint`, {
          prefix: 'Test',
          method: test.method,
          path: test.url.replace(baseUrl, ''),
          expectedStatus: test.expectedStatus
        });

        try {
          const { response } = await testEndpoint(
            baseUrl,
            test.url.replace(baseUrl, ''),
            test.method,
            test.params,
            test.headers
          );

          // For token endpoint with invalid codes, remote server may return 502
          const isTokenEndpoint = test.url.replace(baseUrl, '') === '/token';
          const isRemoteServer = !isLocalhost;
          const isValidStatus = response?.status === test.expectedStatus || 
            (isTokenEndpoint && isRemoteServer && response?.status === 502);

          if (isValidStatus) {
            logger.info(`Test passed`, {
              prefix: 'Test',
              method: test.method,
              path: test.url.replace(baseUrl, ''),
              status: response?.status
            });
            results.passed++;
            console.log(`<<< Test Complete: ${test.name} - PASSED >>>`);
          } else {
            logger.error(`Test failed`, {
              prefix: 'Test',
              method: test.method,
              path: test.url.replace(baseUrl, ''),
              error: `Result: status ${response?.status}, expected ${test.expectedStatus}`,
              expected: test.expectedStatus,
              actual: response?.status,
              requestId: response?.headers?.['x-amzn-requestid'] || ''
            });
            results.failed++;
            results.failures.push({
              endpoint: test.url.replace(baseUrl, ''),
              method: test.method,
              name: test.name,
              error: `Result: status ${response?.status}, expected ${test.expectedStatus}`,
              expected: test.expectedStatus,
              actual: response?.status,
              requestId: response?.headers?.['x-amzn-requestid'] || ''
            });
            console.log(`<<< Test Complete: ${test.name} - FAILED >>>`);
          }
        } catch (error) {
          results.failed++;
          results.failures.push({
            endpoint: test.url.replace(baseUrl, ''),
            method: test.method,
            error: error.message,
            name: test.name,
            requestId: error.response?.headers?.['x-amzn-requestid'] || ''
          });
          logger.error(`Test failed`, {
            prefix: 'Test',
            method: test.method,
            path: test.url.replace(baseUrl, ''),
            error: error.message,
            requestId: error.response?.headers?.['x-amzn-requestid'] || ''
          });
          console.log(`<<< Test Complete: ${test.name} - FAILED >>>`);
        }
        results.total++;
      }
    }
    
    // Step 2: Run favicon test if requested
    if (options.favicon) {
      console.log('\n>>> Running Test: Favicon GET <<<');
      logger.info('Testing endpoint', {
        prefix: 'Test',
        method: 'GET',
        path: '/favicon.ico'
      });

      const { response, analysis } = await testFavicon(baseUrl, { openIco: options.openIco });
      displayFaviconReport(analysis);
      
      if (response.status === 200) {
        results.total++;
        if (analysis.isValidICO) {
          logger.info('Test passed (method=GET path=/favicon.ico)');
          results.passed++;
        } else {
          logger.error('Test failed: Invalid ICO format', {
            prefix: 'Favicon',
            contentType: analysis.contentType,
            size: analysis.size
          });
          results.failed++;
          results.failures.push({
            method: 'GET',
            path: '/favicon.ico',
            error: 'Invalid ICO format'
          });
        }
      } else {
        logger.error('Test failed (method=GET path=/favicon.ico)', {
          status: response.status,
          expected: 200
        });
        results.failed++;
        results.failures.push({
          method: 'GET',
          path: '/favicon.ico',
          error: `Unexpected status code: ${response.status}`
        });
      }
    }

    if (!options.favicon) {
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
          if (failure.requestId) {
            logger.result(`  Request ID: ${failure.requestId}`);
          }
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

    } else if (options.favicon) {
      logger.info('Test suite completed', {
        prefix: 'Summary',
        total: results.total,
        passed: results.passed,
        failed: results.failed
      });
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
  runTests,
  displayFaviconReport
};
