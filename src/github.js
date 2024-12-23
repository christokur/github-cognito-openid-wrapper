const qs = require('qs');
const querystring = require('querystring');
const config = require('./config');
const Configuration = require('./config');
const { gitHubGet, gitHubPost } = require('./github-api');
const logger = require('./connectors/logger');
const { OAuthError, errorTypes } = require('./errors');

class GitHubClient {
  constructor(
    apiBaseUrl = config.GITHUB_API_URL,
    loginBaseUrl = config.GITHUB_LOGIN_URL,
  ) {
    this.apiBaseUrl = apiBaseUrl || config.GITHUB_API_URL;
    this.loginBaseUrl = loginBaseUrl || config.GITHUB_LOGIN_URL;

    if (!this.apiBaseUrl || !this.loginBaseUrl) {
      throw new Error('GitHub API URLs are not configured');
    }
  }

  getApiEndpoints() {
    const endpoints = {
      userDetails: `${this.apiBaseUrl}/user`,
      userEmails: `${this.apiBaseUrl}/user/emails`,
      oauthToken: `${this.loginBaseUrl}/login/oauth/access_token`,
      oauthAuthorize: `${this.loginBaseUrl}/login/oauth/authorize`,
    };
    logger.debug('API Endpoints:', endpoints);
    return endpoints;
  }

  async getUserDetails(accessToken) {
    const endpoints = this.getApiEndpoints();
    return await gitHubGet(endpoints.userDetails, accessToken);
  }

  async getUserEmails(accessToken) {
    const endpoints = this.getApiEndpoints();
    return await gitHubGet(endpoints.userEmails, accessToken);
  }

  getAuthorizeUrl(
    client_id,
    scope,
    state,
    response_type,
    nonce,
    codeChallenge,
  ) {
    const params = {
      client_id,
      scope,
      state,
      response_type,
      redirect_uri: config.COGNITO_REDIRECT_URI,
    };

    if (nonce) {
      params.nonce = nonce;
    }

    if (codeChallenge) {
      params.code_challenge = codeChallenge;
      params.code_challenge_method = 'S256';
    }

    const queryString = qs.stringify(params);
    const endpoints = this.getApiEndpoints();
    console.log(`Generated URL: ${endpoints.oauthAuthorize}?${queryString}`);
    console.log(`Generated URL: ${endpoints.oauthAuthorize}?${queryString}`);
    logger.debug(
      'Constructed URL:',
      `${endpoints.oauthAuthorize}?${queryString}`,
    );
    return `${endpoints.oauthAuthorize}?${queryString}`;
  }

  async getToken(code, codeVerifier) {
    const endpoints = this.getApiEndpoints();
    const params = {
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: config.COGNITO_REDIRECT_URI,
      grant_type: 'authorization_code',
    };

    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    logger.debug('getToken called with:', { code, data: params });

    try {
      logger.debug('Posting to gitHubPost:', params);
      const response = await gitHubPost(endpoints.oauthToken, params);
      logger.debug('Response from gitHubPost:', response);
      // Check for GitHub error response
      if (response.error) {
        logger.error({
          message: 'GitHub API error',
          error: response.error,
          error_description: response.error_description,
        });
        throw new OAuthError(
          errorTypes.INVALID_GRANT,
          response.error_description || response.error,
        );
      }
      // Parse the response if it's a string
      return typeof response === 'string' ? qs.parse(response) : response;
    } catch (error) {
      logger.error('Error in getToken:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken) {
    const [userDetails, userEmails] = await Promise.all([
      this.getUserDetails(accessToken),
      this.getUserEmails(accessToken),
    ]);
    const primaryEmail = userEmails.find((email) => email.primary);
    if (!primaryEmail) {
      throw new Error('User did not have a primary email address');
    }
    return {
      ...userDetails,
      email: primaryEmail.email,
    };
  }
}

const githubClient = (
  apiBaseUrl = config.GITHUB_API_URL,
  loginBaseUrl = config.GITHUB_LOGIN_URL,
) => new GitHubClient(apiBaseUrl, loginBaseUrl);

module.exports = githubClient;
