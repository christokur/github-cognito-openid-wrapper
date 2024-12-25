const logger = require('../../src/connectors/logger');
const PkceHelper = require('../../src/utils/pkce');
const AuthorizationService = require('../../src/services/authorization');

function getTestDefinitions(config) {
  // Generate PKCE values for tests
  const codeVerifier = PkceHelper.generateCodeVerifier();
  const codeChallenge = PkceHelper.generateCodeChallenge(codeVerifier);

  logger.debug({
    message: 'Generating test definitions',
    config,
    codeVerifier,
    codeChallenge
  });
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
      name: 'Token POST with missing code',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 400,
      params: {},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    },
    {
      name: 'Token POST with valid form params',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 400,
      params: {
        grant_type: 'authorization_code',
        code: 'test-code',
        state: '1234567890123456',
        code_verifier: codeVerifier,
        host: 'http://localhost:3000',
        client_id: 'test-client'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    },
    {
      name: 'Token POST with valid JSON params',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 400,
      params: {
        grant_type: 'authorization_code',
        code: 'test-code',
        state: '1234567890123456',
        code_verifier: codeVerifier,
        host: 'http://localhost:3000',
        client_id: 'test-client'
      },
      headers: {
        'Content-Type': 'application/json'
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
      name: 'UserInfo GET without token',
      url: config.userinfo_endpoint,
      method: 'GET',
      expectedStatus: 401
    },
    {
      name: 'UserInfo POST without token',
      url: config.userinfo_endpoint,
      method: 'POST',
      expectedStatus: 401
    },
    {
      name: 'UserInfo GET with token',
      url: config.userinfo_endpoint,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-access-token'
      },
      expectedStatus: config.isLocalhost ? 200 : 401,
      expectedResponse: config.isLocalhost ? {
        sub: '12345',
        name: 'Test User',
        preferred_username: 'test-user',
        email: 'test@example.com',
        email_verified: true
      } : undefined
    },
    {
      name: 'UserInfo POST with token',
      url: config.userinfo_endpoint,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-access-token'
      },
      expectedStatus: config.isLocalhost ? 200 : 401,
      expectedResponse: config.isLocalhost ? {
        sub: '12345',
        name: 'Test User',
        preferred_username: 'test-user',
        email: 'test@example.com',
        email_verified: true
      } : undefined
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
