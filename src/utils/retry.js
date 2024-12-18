const logger = require('../connectors/logger');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const exponentialBackoff = (retryCount, baseDelay = 1000, maxDelay = 10000) => {
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  const jitter = Math.random() * 1000; // Add up to 1s of jitter
  return delay + jitter;
};

const isRetryableError = (error) => {
  if (!error.response) return true; // Network errors are retryable
  
  const status = error.response.status;
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504    // Gateway Timeout
  );
};

async function withRetry(operation, { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = {}) {
  let lastError;
  
  for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
    try {
      if (retryCount > 0) {
        const delay = exponentialBackoff(retryCount - 1, baseDelay, maxDelay);
        logger.debug({
          message: `Retrying operation (attempt ${retryCount}/${maxRetries})`,
          delay
        });
        await wait(delay);
      }
      
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!isRetryableError(error) || retryCount === maxRetries) {
        logger.error({
          message: 'Operation failed after retries',
          error: error.message,
          retryCount
        });
        throw error;
      }
      
      logger.warn({
        message: 'Operation failed, will retry',
        error: error.message,
        retryCount,
        maxRetries
      });
    }
  }
  
  throw lastError;
}

module.exports = {
  withRetry,
  isRetryableError,
  exponentialBackoff
};
