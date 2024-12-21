const logger = require('../connectors/logger');

const gitHubGet = jest.fn().mockImplementation((url, accessToken) => {
  logger.debug({ message: 'Mock GitHub GET request', url, accessToken: accessToken ? '[REDACTED]' : undefined });
  
  if (url.endsWith('/user')) {
    return Promise.resolve({
      id: 12345,
      login: 'test-user',
      name: 'Test User',
      email: 'test@example.com'
    });
  }
  
  if (url.endsWith('/user/emails')) {
    return Promise.resolve([
      {
        email: 'test@example.com',
        primary: true,
        verified: true
      }
    ]);
  }

  return Promise.reject(new Error(`Mock: Unexpected URL ${url}`));
});

const gitHubPost = jest.fn().mockImplementation((url, data) => {
  logger.debug({ message: 'Mock GitHub POST request', url, data });
  
  if (url.endsWith('/login/oauth/access_token')) {
    return Promise.resolve({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      scope: data.scope || 'user:email'
    });
  }

  return Promise.reject(new Error(`Mock: Unexpected URL ${url}`));
});

module.exports = {
  gitHubGet,
  gitHubPost
};
