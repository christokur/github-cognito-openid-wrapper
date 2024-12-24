/**
 * GitHub Error Handling Strategy
 * ----------------------------
 * This module implements a comprehensive error handling strategy for GitHub API interactions.
 * The strategy is based on two separate paths (Response and Error) that maintain clear
 * separation of concerns while ensuring consistent error handling.
 *
 * Response Path (handleGitHubResponse):
 * - Handles direct responses from GitHub API
 * - Processes rate limits
 * - Detects OAuth errors in successful responses
 * - Returns response.data on success
 *
 * Error Path (handleGitHubError):
 * - Handles Axios errors (network issues, non-2xx responses)
 * - Processes rate limits if response exists
 * - Formats error messages based on error type
 *
 * Error Types and Handling:
 *
 * 1. Rate Limit Errors (handled first in both paths)
 *    - Detected via response headers
 *    - Updates internal rate limit tracking
 *    - Format: "GitHub API responded with 429: Rate limit exceeded"
 *    - Status Code: 429 Too Many Requests
 *    - Non-blocking on update failure
 *    - Includes rate limit details in error.limits
 *
 * 2. Network/Connection Errors (Error path only)
 *    - When Axios error has no response object
 *    - Uses Axios's original error message and code
 *    - Examples: "Network Error (ECONNREFUSED)", "Timeout (ETIMEDOUT)"
 *    - Status Code: 503 Service Unavailable
 *    - Includes original request config
 *
 * 3. OAuth Errors (Response path only)
 *    - Detected via response.data.error
 *    - Can occur even with 200 status code
 *    - Format: "Bad Request - [error_type]: [error_description]"
 *    - Status Code: 400 Bad Request
 *    - Includes error_uri when available
 *
 * 4. API Errors (Error path only)
 *    - Non-2xx responses from GitHub
 *    - Format: "GitHub API responded with [status]: [message]"
 *    - Uses response.data.message if available, falls back to statusText
 *    - Maintains original status code
 *    - Includes documentation_url when available
 *
 * Error Object Structure:
 * {
 *   message: string     // Formatted error message following type-specific format
 *   statusCode: number  // HTTP status code appropriate for error type
 *   code?: string      // Original error code (ECONNREFUSED, etc)
 *   response?: {       // Original response object when available
 *     data: Object     // Response body
 *     status: number   // HTTP status
 *     headers: Object  // Response headers
 *   }
 *   request?: {        // Request details that caused the error
 *     url: string      // Request URL
 *     method: string   // HTTP method
 *     headers: Object  // Request headers
 *     timeout: number  // Request timeout
 *   }
 *   limits?: {         // Rate limit information if available
 *     limit: number    // Total requests allowed
 *     remaining: number// Requests remaining
 *     reset: number    // Reset timestamp
 *   }
 *   docs?: string      // Documentation URL if provided
 * }
 *
 * Implementation Notes:
 * - All errors are created via createGitHubError helper for consistency
 * - Rate limit handling is centralized in handleRateLimits
 * - Extensive logging at each stage of error handling
 * - Clear separation between response and error paths
 * - Proper error inheritance maintained
 * - All original error context is preserved
 */

const logger = require('./connectors/logger');
const rateLimiter = require('./utils/rate-limiter');

/**
 * Creates a standardized GitHub error object
 * @param {string} message - Error message following our format guidelines
 * @param {number} statusCode - HTTP status code
 * @param {Object} options - Additional error properties
 * @param {Object} [options.response] - Original response if available
 * @param {Object} [options.request] - Request details that caused error
 * @param {string} [options.code] - Error code (ECONNREFUSED, etc)
 * @param {Object} [options.limits] - Rate limit information
 * @param {string} [options.docs] - Documentation URL
 * @returns {Error} Standardized error object
 */
const createGitHubError = (message, statusCode, options = {}) => {
  const error = new Error(message);
  const { response, request, code, limits, docs } = options;

  Object.assign(error, {
    statusCode,
    ...(code && { code }),
    ...(response && { response }),
    ...(request && { request }),
    ...(limits && { limits }),
    ...(docs && { docs }),
  });

  return error;
};

/**
 * Extracts rate limit information from response headers
 * @param {Object} headers - Response headers
 * @returns {Object|null} Rate limit info or null if not present
 */
const getRateLimits = (headers) => {
  if (!headers) return null;

  const limit = headers['x-ratelimit-limit'];
  const remaining = headers['x-ratelimit-remaining'];
  const reset = headers['x-ratelimit-reset'];

  if (!limit || !remaining || !reset) return null;

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: parseInt(reset, 10),
  };
};

/**
 * Extracts request details from Axios config
 * @param {Object} config - Axios request config
 * @returns {Object} Normalized request details
 */
const getRequestDetails = (config) => {
  if (!config) return null;

  return {
    url: config.url,
    method: config.method,
    headers: config.headers,
    timeout: config.timeout,
  };
};

/**
 * Handles rate limit checking and updating for any GitHub response.
 * This function is idempotent - it will only update rate limits once per response
 * by tracking the rateLimitsUpdated flag on the response object.
 *
 * @param {Object} headers - Response headers to check for rate limits
 * @param {Object} [fullResponse] - Full response object for error creation
 * @param {boolean} [fullResponse.rateLimitsUpdated] - Flag indicating if limits were already updated
 * @throws {Error} If rate limit is exceeded
 */
const handleRateLimits = async (headers, fullResponse = null) => {
  if (!headers || (fullResponse && fullResponse.rateLimitsUpdated)) return;

  try {
    await rateLimiter.updateLimits(headers);
    if (fullResponse) fullResponse.rateLimitsUpdated = true;

    if (rateLimiter.isRateLimitError(fullResponse)) {
      await rateLimiter.checkLimit();
      throw createGitHubError(
        'GitHub API responded with 429: Rate limit exceeded',
        429,
        {
          limits: getRateLimits(headers),
          response: fullResponse,
        },
      );
    }
  } catch (e) {
    logger.error('Failed to handle rate limits', e);
    // Non-blocking - we continue processing even if rate limit handling fails
  }
};

const handleGitHubResponse = async (response, config = null) => {
  logger.debug({
    message: 'GitHub response received',
    response,
    config,
  });

  // Handle rate limits first
  await handleRateLimits(response?.headers, response);

  // Check for empty response
  if (!response) {
    throw createGitHubError(
      'Invalid GitHub response: Empty response received',
      503,
      {
        request: getRequestDetails(config),
      },
    );
  }

  logger.debug({
    message: 'GitHub response details',
    status: response?.status || 'unknown',
    headers: response?.headers || 'unknown',
    data: response?.data || 'unknown',
  });

  // Handle OAuth specific errors (can come with 200 status)
  if (response.data?.error) {
    const { error: errorType, error_description, error_uri } = response.data;
    throw createGitHubError(
      `Bad Request - ${errorType}: ${error_description}`,
      400,
      {
        response,
        request: getRequestDetails(config),
        docs: error_uri,
      },
    );
  }

  return response.data;
};

const handleGitHubError = async (error) => {
  logger.error({
    message: 'GitHub request failed',
    error:
      error instanceof Error
        ? {
            message: error.message,
            code: error.code,
            stack: error.stack,
          }
        : error,
  });

  // Handle rate limits first if we have response
  await handleRateLimits(error.response?.headers, error.response);

  // Handle network errors (no response)
  if (!error.response) {
    throw createGitHubError(
      `${error.message}${error.code ? ` (${error.code})` : ''}`,
      503,
      {
        code: error.code,
        request: getRequestDetails(error.config),
      },
    );
  }

  // Handle standard API errors with response
  const { status, statusText } = error.response;
  const message = error.response.data?.message || statusText;
  const docs = error.response.data?.documentation_url;

  throw createGitHubError(
    `GitHub API responded with ${status}: ${message}`,
    status,
    {
      response: error.response,
      request: getRequestDetails(error.config),
      docs,
    },
  );
};

module.exports = {
  handleGitHubResponse,
  handleGitHubError,
};
