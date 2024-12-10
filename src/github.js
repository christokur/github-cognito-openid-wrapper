const axios = require('axios');
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

const check = (response) => {
  logger.debug('Checking response: %j', response, {});
  if (response.status !== 200) {
    throw new Error(
      `GitHub API responded with a failure: ${response.status} (${response.statusText})`,
    );
  }

  if (response.data && response.data.message) {
    throw new Error(
      `GitHub API responded with a failure: ${response.data.message}`,
    );
  }

  return response.data;
} ;

const gitHubGet = (url, accessToken) => {
  console.log('Making request to URL:', url); // Log the URL being used
  return axios({
    method: 'get',
    url,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${accessToken}`,
    },
  })
    .then(check);
};

function githubClient(
  apiBaseUrl = GITHUB_API_URL,
  loginBaseUrl = GITHUB_LOGIN_URL,
) {
  console.log('GITHUB_API_URL:', apiBaseUrl); // Log the API base URL
  const urls = getApiEndpoints(apiBaseUrl, loginBaseUrl);
  console.log('API Endpoints:', urls); // Log the URLs object

  return {
    getAuthorizeUrl: (client_id, scope, state, response_type) =>
      `${urls.oauthAuthorize}?client_id=${client_id}&scope=${encodeURIComponent(
        scope,
      )}&state=${state}&response_type=${response_type}`,

    getUserDetails: (accessToken) =>
      gitHubGet(urls.userDetails, accessToken),

    getUserEmails: (accessToken) =>
      gitHubGet(urls.userEmails, accessToken),
    getToken: (code, state) => {
      const data = {
        // OAuth required fields
        grant_type: 'authorization_code',
        redirect_uri: COGNITO_REDIRECT_URI,
        client_id: GITHUB_CLIENT_ID,
        // GitHub Specific
        response_type: 'code',
        client_secret: GITHUB_CLIENT_SECRET,
        code,
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
          'Content-Type': 'application/json',
        },
        data,
      })
        .then(check)
        .catch((error) => {
          if (error.response) {
            throw new Error(
              `GitHub API responded with a failure: ${error.response.status} (${error.response.statusText})`,
            );
          }
          throw error;
        });
    },
  };
}

module.exports = githubClient;
