const logger = require('./connectors/logger');
const { withRetry } = require('./utils/retry');
const { getAxios } = require('./helpers');
const { handleGitHubResponse, handleGitHubError } = require('./github-errors');
const Configuration = require('./config');

const gitHubGet = (url, accessToken) => {
  logger.debug({ message: 'Making GitHub API request', url, accessToken: accessToken ? '[REDACTED]' : undefined });
  const config = { 
    headers: { 
      Accept: `application/vnd.github.${Configuration.GITHUB_API_VERSION}+json`,
      Authorization: `token ${accessToken}` 
    },
    timeout: Configuration.GITHUB_API_TIMEOUT
  };
  const axios = getAxios();
  return withRetry(() => axios.get(url, config))
    .then(handleGitHubResponse)
    .catch(handleGitHubError);
};

const gitHubPost = (url, data) => {
  const config = { 
    headers: { 
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded' 
    },
    timeout: Configuration.GITHUB_API_TIMEOUT
  };
  const axios = getAxios();
  return withRetry(() => axios.post(url, data, config))
    .then(handleGitHubResponse)
    .catch(handleGitHubError);
};

module.exports = {
  gitHubGet,
  gitHubPost
};
