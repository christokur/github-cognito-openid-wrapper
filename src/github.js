const qs = require('qs');
const config = require('./config');
const { gitHubGet, gitHubPost } = require('./github-api');

class GitHubClient {
  constructor(apiBaseUrl = config.GITHUB_API_URL, loginBaseUrl = config.GITHUB_LOGIN_URL) {
    this.apiBaseUrl = apiBaseUrl || config.GITHUB_API_URL;
    this.loginBaseUrl = loginBaseUrl || config.GITHUB_LOGIN_URL;

    if (!this.apiBaseUrl || !this.loginBaseUrl) {
      throw new Error('GitHub API URLs are not configured');
    }
  }

  getApiEndpoints() {
    return {
      userDetails: `${this.apiBaseUrl}/user`,
      userEmails: `${this.apiBaseUrl}/user/emails`,
      oauthToken: `${this.loginBaseUrl}/login/oauth/access_token`,
      oauthAuthorize: `${this.loginBaseUrl}/login/oauth/authorize`,
    };
  }

  getUserDetails(accessToken) {
    const endpoints = this.getApiEndpoints();
    return gitHubGet(endpoints.userDetails, accessToken);
  }

  getUserEmails(accessToken) {
    const endpoints = this.getApiEndpoints();
    return gitHubGet(endpoints.userEmails, accessToken);
  }

  getAuthorizeUrl(client_id, scope, state, response_type, nonce, codeChallenge) {
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
    return `${endpoints.oauthAuthorize}?${queryString}`;
  }

  getToken(code) {
    const endpoints = this.getApiEndpoints();
    const data = {
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: config.COGNITO_REDIRECT_URI,
    };

    return gitHubPost(endpoints.oauthToken, qs.stringify(data))
      .then(responseData => responseData.access_token);
  }

  getUserInfo(accessToken) {
    return this.getUserDetails(accessToken)
      .then(userDetails => {
        return this.getUserEmails(accessToken)
          .then(userEmails => {
            const primaryEmail = userEmails.find(email => email.primary);
            if (!primaryEmail) {
              throw new Error('User did not have a primary email address');
            }
            return {
              ...userDetails,
              email: primaryEmail.email
            };
          });
      });
  }
}

const githubClient = (apiBaseUrl = config.GITHUB_API_URL, loginBaseUrl = config.GITHUB_LOGIN_URL) => {
  return new GitHubClient(apiBaseUrl, loginBaseUrl);
};

