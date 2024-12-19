const logger = require('./connectors/logger');
const { withRetry } = require('./utils/retry');
const { getAxios } = require('./helpers');
const { handleGitHubResponse, handleGitHubError } = require('./github-errors');

const gitHubGet = (url, accessToken) => {
  logger.debug({ message: 'Making GitHub API request', url, accessToken: accessToken ? '[REDACTED]' : undefined });
  const config = { headers: { Authorization: `Bearer ${accessToken}` } };
  const axios = getAxios();
  return withRetry(() => axios.get(url, config))
    .then(handleGitHubResponse)
    .catch(handleGitHubError);
};

const gitHubPost = (url, data) => {
  const config = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
  const axios = getAxios();
  return withRetry(() => axios.post(url, data, config))
    .then(handleGitHubResponse)
    .catch(handleGitHubError);
};

module.exports = {
  gitHubGet,
  gitHubPost
};
