/**
 * Default implementation of exponential backoff with jitter
 * @param {number} retryCount - Current retry attempt number
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000ms)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 10000ms)
 * @returns {number} Calculated delay with jitter in milliseconds
 */
function defaultExponentialBackoff(retryCount, baseDelay = 1000, maxDelay = 10000) {
  const delay = Math.min(baseDelay * 2 ** retryCount, maxDelay);
  const jitter = Math.random() * 1000; // Add up to 1s of jitter
  return delay + jitter;
}
const exponentialBackoff = defaultExponentialBackoff;
// Export the default implementation
module.exports = {
  defaultExponentialBackoff,
  exponentialBackoff,
};
