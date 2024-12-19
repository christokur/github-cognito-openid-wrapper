const qs = require('qs');
const {
  GITHUB_API_URL,
  GITHUB_LOGIN_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  COGNITO_REDIRECT_URI,
} = require('./config');
const { gitHubGet, gitHubPost } = require('./github-api');

class GitHubClient {
  constructor(apiBaseUrl = GITHUB_API_URL, loginBaseUrl = GITHUB_LOGIN_URL) {
    this.apiBaseUrl = apiBaseUrl || GITHUB_API_URL;
    this.loginBaseUrl = loginBaseUrl || GITHUB_LOGIN_URL;

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

  getAuthorizeUrl(state, nonce, codeChallenge) {
    const params = {
      client_id: GITHUB_CLIENT_ID,
      scope: 'user:email',
      state,
      response_type: 'code',
      redirect_uri: COGNITO_REDIRECT_URI,
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
    return `${endpoints.oauthAuthorize}?${queryString}`;
  }

  getToken(code) {
    const endpoints = this.getApiEndpoints();
    const data = {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: COGNITO_REDIRECT_URI,
    };

    return gitHubPost(endpoints.oauthToken, qs.stringify(data));
  }
}

const githubClient = (apiBaseUrl = GITHUB_API_URL, loginBaseUrl = GITHUB_LOGIN_URL) => {
  return new GitHubClient(apiBaseUrl, loginBaseUrl);
};

module.exports = githubClient;
