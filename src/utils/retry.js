const logger = require('../connectors/logger');
const backoff = require('./backoff');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isRetryableError = (error) => {
  const retry = error?.isRetryable || true;
  if (!retry) return false; // Custom errors can be marked as non-retryable
  if (!error.response) return true; // Network errors are retryable

  const status = error.response?.status || 0;
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504 // Gateway Timeout
  );
};

async function withRetry(
  operation,
  { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = {},
) {
  let retryCount = 0;
  let error;

  while (retryCount <= maxRetries) {
    try {
      // If operation() returns a promise, we await it here
      const result = await operation();
      // If it succeeded, return immediately
      return result;
    } catch (err) {
      error = err;

      if (!isRetryableError(error) || retryCount === maxRetries) {
        logger.error({
          message: 'Operation failed after retries',
          error: error.message,
          retryCount,
        });
        throw error;
      }

      // Otherwise, increment and do a backoff
      retryCount++;
      const delay = backoff.exponentialBackoff(
        retryCount - 1,
        baseDelay,
        maxDelay,
      );
      logger.debug({
        message: `Retrying operation (attempt ${retryCount}/${maxRetries})`,
        delay,
      });

      // This wait function should return a promise that resolves after `delay` ms
      await wait(delay);
    }
  }
}
module.exports = {
  withRetry,
  isRetryableError,
};
