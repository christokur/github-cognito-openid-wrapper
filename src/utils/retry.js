const logger = require('../connectors/logger');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const exponentialBackoff = (retryCount, baseDelay = 1000, maxDelay = 10000) => {
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  const jitter = Math.random() * 1000; // Add up to 1s of jitter
  return delay + jitter;
};

const isRetryableError = (error) => {
  const retry = error?.isRetryable || true
  if (!retry) return false; // Custom errors can be marked as non-retryable
  if (!error.response) return true; // Network errors are retryable

  const status = error.response?.status || 0;
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504    // Gateway Timeout
  );
};

function withRetry(operation, { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = {}) {
  let retryCount = 0;
  let result;
  let error;

  while (retryCount <= maxRetries) {
    try {
      result = operation();
      break;
    } catch (err) {
      error = err;
      if (!isRetryableError(error) || retryCount === maxRetries) {
        logger.error({
          message: 'Operation failed after retries',
          error: error.message,
          retryCount
        });
        throw error;
      }

      retryCount++;
      const delay = exponentialBackoff(retryCount - 1, baseDelay, maxDelay);
      logger.debug({
        message: `Retrying operation (attempt ${retryCount}/${maxRetries})`,
        delay
      });
      wait(delay);
    }
  }

  return result;
}

module.exports = {
  withRetry,
  isRetryableError,
  exponentialBackoff
};
