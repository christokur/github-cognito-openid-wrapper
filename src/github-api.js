/**
 * GitHub API Integration
 * --------------------
 * This module provides a standardized interface for making GitHub API requests.
 * It handles authentication, retries, rate limiting, and error handling consistently
 * across all GitHub API interactions.
 *
 * Key Features:
 * 1. Automatic retries via withRetry
 * 2. Rate limit tracking and prevention
 * 3. Comprehensive error handling
 * 4. Request context preservation
 *
 * Error Handling Strategy:
 * - All errors are processed through github-errors.js
 * - Full request context is preserved (URL, method, headers, timeout)
 * - Rate limits are tracked and exposed
 * - Documentation URLs are included when available
 * - Original error codes and messages are maintained
 *
 * Common Error Types:
 * 1. Rate Limits (429)
 *    - Tracked via X-RateLimit headers
 *    - Includes limit, remaining, reset time
 *
 * 2. Authentication (401, 403)
 *    - Bad or expired tokens
 *    - Insufficient permissions
 *
 * 3. OAuth Specific
 *    - Can occur even with 200 status
 *    - Include error_uri for troubleshooting
 *
 * 4. Network/Connection
 *    - No response from GitHub
 *    - Timeout or connection refused
 *
 * Configuration:
 * - API Version: Configurable via GITHUB_API_VERSION
 * - Timeout: Set via GITHUB_API_TIMEOUT
 * - Headers: Standardized for GET/POST
 *
 * Usage Notes:
 * 1. Always check response.data for error field
 * 2. Rate limits are handled automatically
 * 3. Errors contain full context for debugging
 * 4. Retry logic is configurable via utils/retry
 */

const logger = require('./connectors/logger');
const { withRetry } = require('./utils/retry');
const { getAxios } = require('./helpers');
const { handleGitHubResponse, handleGitHubError } = require('./github-errors');
const Configuration = require('./config');

const gitHubGet = async (url, accessToken) => {
  logger.debug({
    message: 'Making GitHub API GET request',
    url,
    accessToken,
  });

  const config = {
    url, // Include URL in config for error context
    method: 'GET',
    headers: {
      Accept: `application/vnd.github.${Configuration.GITHUB_API_VERSION}+json`,
      Authorization: `token ${accessToken}`,
    },
    timeout: Configuration.GITHUB_API_TIMEOUT,
  };

  const axios = getAxios();

  try {
    // Important: ensure withRetry returns a Promise and uses await for async operations
    const response = await withRetry(() => axios.get(url, config));
    // Pass full config for request context
    return handleGitHubResponse(response, config);
  } catch (err) {
    // Ensure error has the request config
    err.config = err.config || config;
    return handleGitHubError(err);
  }
};

const gitHubPost = async (url, data) => {
  logger.debug({ message: 'Making GitHub API POST request', url, data });

  const config = {
    url, // Include URL in config for error context
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: Configuration.GITHUB_API_TIMEOUT,
  };

  const axios = getAxios();

  try {
    // Important: ensure withRetry returns a Promise and uses await for async operations
    const response = await withRetry(() => axios.post(url, data, config));
    // Pass full config for request context
    return handleGitHubResponse(response, config);
  } catch (err) {
    // Ensure error has the request config
    err.config = err.config || config;
    return handleGitHubError(err);
  }
};

module.exports = {
  gitHubGet,
  gitHubPost,
};
