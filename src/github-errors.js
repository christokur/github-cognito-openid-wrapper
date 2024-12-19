const logger = require('./connectors/logger');
const rateLimiter = require('./utils/rate-limiter');

const handleGitHubResponse = (response) => {
  if (!response) {
    logger.error({
      message: 'Empty response received from GitHub'
    });
    const error = new Error('Empty response received from GitHub');
    error.isNetworkError = true;
    throw error;
  }

  logger.debug({
    message: 'GitHub response details',
    status: response?.status || 'unknown',
    headers: response?.headers || 'unknown',
    data: response?.data || 'unknown'
  });

  // Update rate limits from response headers
  if (response.headers) {
    rateLimiter.updateLimits(response.headers);
  }

  // Check for error response
  if (response.status >= 400 || (response.data && response.data.message)) {
    const error = new Error();
    error.response = response;
    throw handleGitHubError(error);
  }

  // For OAuth errors
  if (response.data && response.data.error) {
    const error = new Error();
    error.response = response;
    throw handleGitHubError(error);
  }

  return response.data;
};

const handleGitHubError = (error) => {
  logger.error({
    message: 'GitHub request failed',
    error: error instanceof Error ? {
      message: error.message,
      code: error.code,
      stack: error.stack
    } : error
  });

  // Handle axios errors with response
  if (error.response) {
    // Update rate limits from error response headers if they exist
    if (error.response.headers) {
      try {
        rateLimiter.updateLimits(error.response.headers);
      } catch (e) {
        logger.error({
          message: 'Failed to update rate limits',
          error: e
        });
      }
    }

    // Handle rate limiting specifically
    if (rateLimiter.isRateLimitError(error)) {
      try {
        rateLimiter.checkLimit();
      } catch (err) {
        throw err;
      }
      throw new Error('GitHub API responded with a failure: 429 (API rate limit exceeded)');
    }

    const status = error.response.status;
    const statusText = error.response.statusText;
    let message = statusText;

    logger.error({
      message: message,
      status,
      statusText,
      data: error.response.data
    });

    // For OAuth endpoints
    if (error.response.data && error.response.data.error) {
      const { error: errorType, error_description } = error.response.data;
      message = `Bad Request - ${errorType}: ${error_description}`;
    }
    // For all other endpoints
    else if (error.response.data && error.response.data.message) {
      message = error.response.data.message;
    }

    const err = new Error(`GitHub API responded with a failure: ${status} (${message})`);
    err.statusCode = status;
    err.type = 'github_error';
    throw err;
  }

  // Handle network errors
  if (!error.response) {
    logger.error({
      message: 'Network error occurred',
      error: error.message || 'Unknown network error'
    });
    const err = new Error('Network error occurred while contacting GitHub API');
    err.statusCode = 503;
    err.type = 'network_error';
    throw err;
  }

  error.statusCode = error.statusCode || 500;
  error.type = error.type || 'github_error';
  throw error;
};

module.exports = {
  handleGitHubResponse,
  handleGitHubError,
};
