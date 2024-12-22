const logger = require('../../src/connectors/logger');
const PkceHelper = require('../../src/utils/pkce');
const AuthorizationService = require('../../src/services/authorization');

function getTestDefinitions(config) {
  // Generate PKCE values for tests
  const codeVerifier = PkceHelper.generateCodeVerifier();
  const codeChallenge = PkceHelper.generateCodeChallenge(codeVerifier);

  return [
    // Authorization endpoint tests
    {
      name: 'Authorization GET w/ status',
      url: config.authorization_endpoint,
      method: 'GET',
      expectedStatus: 302,
      params: {
        client_id: 'test-client',
        scope: 'openid',
        state: '1234567890123456',
        response_type: 'code',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      }
    },
    {
      name: 'Authorization GET w/0 status',
      url: config.authorization_endpoint,
      method: 'GET',
      expectedStatus: 400,
      params: {}
    },
    {
      name: 'Authorization POST',
      url: config.authorization_endpoint,
      method: 'POST',
      expectedStatus: 405
    },
    {
      name: 'Authorization PUT',
      url: config.authorization_endpoint,
      method: 'PUT',
      expectedStatus: 405
    },
    {
      name: 'Authorization DELETE',
      url: config.authorization_endpoint,
      method: 'DELETE',
      expectedStatus: 405
    },
    // Token endpoint tests
    {
      name: 'Token POST w/ params & no host',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 400,
      params: {
        code: 'test-code',
        state: '1234567890123456',
        code_verifier: codeVerifier,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    },
    {
      name: 'Token POST w/ JSON params',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 200,
      params: {
        code: 'test-code',
        state: '1234567890123456',
        code_verifier: codeVerifier,
        host: 'http://localhost:3000'
      },
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Token POST w/ params & host',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 400,
      params: {
        code: 'test-code',
        state: '1234567890123456',
        code_verifier: codeVerifier,
        host: 'http://localhost:3000'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    },
    {
      name: 'Token POST w/ JSON params and no host',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 200,
      params: {
        code: 'test-code',
        state: '1234567890123456',
        code_verifier: codeVerifier,
      },
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Token POST w/o params',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 400,
      params: {},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    },
    {
      name: 'Token GET',
      url: config.token_endpoint,
      method: 'GET',
      expectedStatus: 405
    },
    {
      name: 'Token PUT',
      url: config.token_endpoint,
      method: 'PUT',
      expectedStatus: 405
    },
    {
      name: 'Token DELETE',
      url: config.token_endpoint,
      method: 'DELETE',
      expectedStatus: 405
    },
    // UserInfo endpoint tests
    {
      name: 'UserInfo GET',
      url: config.userinfo_endpoint,
      method: 'GET',
      expectedStatus: 401
    },
    {
      name: 'UserInfo POST',
      url: config.userinfo_endpoint,
      method: 'POST',
      expectedStatus: 405
    },
    {
      name: 'UserInfo PUT',
      url: config.userinfo_endpoint,
      method: 'PUT',
      expectedStatus: 405
    },
    {
      name: 'UserInfo DELETE',
      url: config.userinfo_endpoint,
      method: 'DELETE',
      expectedStatus: 405
    },
    // Favicon tests
    {
      name: 'Favicon GET',
      url: `${config.issuer}/favicon.ico`,
      method: 'GET',
      expectedStatus: 200,
      headers: {
        'Accept': 'image/x-icon'
      }
    }
  ];
}

module.exports = {
  getTestDefinitions
};
