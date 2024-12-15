const axios = require('axios');
const qs = require('qs');
const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  COGNITO_REDIRECT_URI,
  GITHUB_API_URL,
  GITHUB_LOGIN_URL,
} = require('./config');
const logger  = require('./connectors/logger');

const getApiEndpoints = (
  apiBaseUrl = GITHUB_API_URL,
  loginBaseUrl = GITHUB_LOGIN_URL,
) => ({
  userDetails: `${apiBaseUrl}/user`,
  userEmails: `${apiBaseUrl}/user/emails`,
  oauthToken: `${loginBaseUrl}/login/oauth/access_token`,
  oauthAuthorize: `${loginBaseUrl}/login/oauth/authorize`,
});

const handleGitHubResponse = (response) => {
  logger.debug('Checking response: %j', response, {});
  
  // For 200 responses with error messages (some GitHub API endpoints do this)
  if (response.data && response.data.message) {
    throw new Error(`GitHub API responded with a failure: ${response.status} (${response.data.message})`);
  }
  
  return response.data;
};

const handleGitHubError = (error, isOAuth = false) => {
  if (!error.response) {
    throw error;
  }

  const status = error.response.status;
  const statusText = error.response.statusText;
  let message;

  // For OAuth endpoints
  if (isOAuth && error.response.data) {
    const { error: errorType, error_description } = error.response.data;
    message = errorType && error_description ? 
      `${statusText} - ${errorType}: ${error_description}` :
      statusText;
  }
  // For all other endpoints 
  else if (error.response.data && error.response.data.message) {
    message = error.response.data.message;
  }
  // Fallback to status text
 
  throw new Error(`GitHub API responded with a failure: ${status} (${message})`);
  
};

const gitHubGet = (url, accessToken) => {
  logger.debug('Making request to URL: %s', url, {});
  return axios({
    method: 'get',
    url,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${accessToken}`,
    },
  })
    .then(handleGitHubResponse)
    .catch((error) => handleGitHubError(error, false));
};

function githubClient(
  apiBaseUrl = GITHUB_API_URL,
  loginBaseUrl = GITHUB_LOGIN_URL,
) {
  logger.debug('GITHUB_API_URL: %s', apiBaseUrl, {});
  const urls = getApiEndpoints(apiBaseUrl, loginBaseUrl);
  logger.debug('API Endpoints: %j', urls, {});

  return {
    getAuthorizeUrl: (client_id, scope, state, response_type) =>
      `${urls.oauthAuthorize}?client_id=${client_id}&scope=${encodeURIComponent(
        scope,
      )}&state=${state}&response_type=${response_type}&redirect_uri=${encodeURIComponent(COGNITO_REDIRECT_URI)}`,

    getUserDetails: (accessToken) =>
      gitHubGet(urls.userDetails, accessToken),

    getUserEmails: (accessToken) =>
      gitHubGet(urls.userEmails, accessToken),

    getToken: (code, state) => {
      const data = {
        // Required GitHub OAuth fields first
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        // Optional redirect_uri
        redirect_uri: COGNITO_REDIRECT_URI,
        // OAuth 2.0 fields
        grant_type: 'authorization_code',
        response_type: 'code',
        // State may not be present, so we conditionally include it
        ...(state && { state }),
      };

      logger.debug(
        'Getting token from %s with data: %j',
        urls.oauthToken,
        data,
        {},
      );
      return axios({
        method: 'post',
        url: urls.oauthToken,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: qs.stringify(data),
      })
        .then(handleGitHubResponse)
        .catch((error) => handleGitHubError(error, true));
    },
  };
}

module.exports = githubClient;
