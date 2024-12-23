const logger = require('./connectors/logger');
const { withRetry } = require('./utils/retry');
const { getAxios } = require('./helpers');
const { handleGitHubResponse, handleGitHubError } = require('./github-errors');
const Configuration = require('./config');

const gitHubGet = (url, accessToken) => {
  logger.debug({
    message: 'Making GitHub API GET request',
    url,
    accessToken,
  });
  const config = {
    headers: {
      Accept: `application/vnd.github.${Configuration.GITHUB_API_VERSION}+json`,
      Authorization: `token ${accessToken}`,
    },
    timeout: Configuration.GITHUB_API_TIMEOUT,
  };
  const axios = getAxios();
  return withRetry(() => axios.get(url, config)
    .then(handleGitHubResponse)
    .catch(handleGitHubError)
  );
};

const gitHubPost = (url, data) => {
  logger.debug({
    message: 'Making GitHub API POST request',
    url,
    data,
  });
  const config = {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: Configuration.GITHUB_API_TIMEOUT,
    //  transformRequest: [(data) => data] // Prevent axios from auto-encoding
  };
  const axios = getAxios();
  return withRetry(() => 
    axios.post(url, data, config)
      .then(handleGitHubResponse)
      .catch(handleGitHubError)
  );
};

module.exports = {
  gitHubGet,
  gitHubPost,
};
