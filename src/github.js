const axios = require('axios');
const qs = require('qs');
const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  COGNITO_REDIRECT_URI,
  GITHUB_API_URL,
  GITHUB_LOGIN_URL,
} = require('./config');
const logger = require('./connectors/logger');
const rateLimiter = require('./utils/rate-limiter');
const { withRetry } = require('./utils/retry');

const getApiEndpoints = (
  apiBaseUrl = GITHUB_API_URL,
  loginBaseUrl = GITHUB_LOGIN_URL,
) => {
  // Ensure we have valid base URLs
  const validApiBaseUrl = apiBaseUrl || GITHUB_API_URL;
  const validLoginBaseUrl = loginBaseUrl || GITHUB_LOGIN_URL;

  if (!validApiBaseUrl || !validLoginBaseUrl) {
    throw new Error('GitHub API URLs are not configured');
  }

  return {
    userDetails: `${validApiBaseUrl}/user`,
    userEmails: `${validApiBaseUrl}/user/emails`,
    oauthToken: `${validLoginBaseUrl}/login/oauth/access_token`,
    oauthAuthorize: `${validLoginBaseUrl}/login/oauth/authorize`,
  };
};

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
    status: response.status,
    headers: response.headers,
    data: response.data
  });

  // Update rate limits from response headers
  rateLimiter.updateLimits(response.headers);
  
  // For 200 responses with OAuth errors
  if (response.data && response.data.error) {
    logger.error({
      message: 'GitHub OAuth error in 200 response',
      error: response.data.error,
      error_description: response.data.error_description
    });
    return Promise.reject(new Error(`GitHub API responded with a failure: ${response.status} (Bad Request - ${response.data.error}: ${response.data.error_description})`));
  }

  // For 200 responses with error messages (some GitHub API endpoints do this)
  if (response.data && response.data.message) {
    logger.error({
      message: 'GitHub API error in 200 response',
      errorMessage: response.data.message
    });
    return Promise.reject(new Error(`GitHub API responded with a failure: ${response.status} (${response.data.message})`));
  }
  
  return response.data;
};

const handleGitHubError = async (error) => {
  logger.error({
    message: 'GitHub request failed',
    error: error instanceof Error ? {
      message: error.message,
      code: error.code,
      stack: error.stack
    } : error
  });

  if (error.isNetworkError || !error.response) {
    logger.error({
      message: 'Network error occurred',
      error: error.message || 'Unknown network error'
    });
    return Promise.reject(error);
  }

  // Update rate limits from error response headers
  if (error.response.headers) {
    rateLimiter.updateLimits(error.response.headers);
  }

  // Handle rate limiting specifically
  if (rateLimiter.isRateLimitError(error)) {
    await rateLimiter.checkLimit();
    return Promise.reject(new Error(`GitHub API responded with a failure: 429 (API rate limit exceeded)`));
  }

  const status = error.response.status;
  const statusText = error.response.statusText;
  let message = statusText;

  logger.error({
    message: 'GitHub error details',
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

  return Promise.reject(new Error(`GitHub API responded with a failure: ${status} (${message})`));
};

const gitHubGet = async (url, accessToken) => {
  try {
    logger.debug({
      message: 'Making request to URL',
      url
    });
    
    // Check rate limits before making request
    await rateLimiter.checkLimit();

    const memBefore = process.memoryUsage();
    logger.debug({
      message: 'Memory usage before GitHub GET',
      memoryUsage: memBefore
    });
  
    const response = await withRetry(() => 
      axios({
        method: 'get',
        url,
        timeout: 10000, // 10 second timeout
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${accessToken}`,
        },
      })
    );

    const memAfter = process.memoryUsage();
    logger.debug({
      message: 'Memory usage after GitHub GET',
      memoryUsage: memAfter
    });

    return handleGitHubResponse(response);
  } catch (error) {
    return handleGitHubError(error);
  }
};

const githubClient = (
  apiBaseUrl = GITHUB_API_URL,
  loginBaseUrl = GITHUB_LOGIN_URL,
) => {
  const endpoints = getApiEndpoints(apiBaseUrl, loginBaseUrl);

  return {
    getAuthorizeUrl: (state, nonce, codeChallenge) => {
      const params = {
        client_id: GITHUB_CLIENT_ID,
        scope: 'user:email',
        state,
        response_type: 'code',
        redirect_uri: COGNITO_REDIRECT_URI
      };
      
      if (nonce) {
        params.nonce = nonce;
      }
      
      if (codeChallenge) {
        params.code_challenge = codeChallenge;
        params.code_challenge_method = 'S256';
      }
      
      const queryString = qs.stringify(params);
      return `${endpoints.oauthAuthorize}?${queryString}`;
    },

    getToken: async (code, state, codeVerifier) => {
      try {
        const memBefore = process.memoryUsage();
        logger.debug({
          message: 'Memory usage before GitHub token request',
          memoryUsage: memBefore
        });

        // OAuth endpoints don't count against rate limits, but we'll still use retries
        const response = await withRetry(() =>
          axios({
            method: 'post',
            url: endpoints.oauthToken,
            timeout: 10000,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: qs.stringify({
              client_id: GITHUB_CLIENT_ID,
              client_secret: GITHUB_CLIENT_SECRET,
              code,
              state,
              redirect_uri: COGNITO_REDIRECT_URI,
              code_verifier: codeVerifier
            })
          })
        );

        const memAfter = process.memoryUsage();
        logger.debug({
          message: 'Memory usage after GitHub token request',
          memoryUsage: memAfter
        });

        return handleGitHubResponse(response);
      } catch (error) {
        return handleGitHubError(error);
      }
    },

    getUserDetails: async (accessToken) => {
      try {
        return await gitHubGet(endpoints.userDetails, accessToken);
      } catch (error) {
        logger.error({
          message: 'Failed to get user details',
          error: error.message || error
        });
        throw error;
      }
    },

    getUserEmails: async (accessToken) => {
      try {
        return await gitHubGet(endpoints.userEmails, accessToken);
      } catch (error) {
        logger.error({
          message: 'Failed to get user emails',
          error: error.message || error
        });
        throw error;
      }
    },
  };
};

module.exports = githubClient;
