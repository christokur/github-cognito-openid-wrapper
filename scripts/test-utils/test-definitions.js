const logger = require('../../src/connectors/logger');

function getTestDefinitions(config) {
  return [
    // Authorization endpoint tests
    {
      name: 'Authorization GET',
      url: config.authorization_endpoint,
      method: 'GET',
      expectedStatus: 200
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
      name: 'Token POST',
      url: config.token_endpoint,
      method: 'POST',
      expectedStatus: 200
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
    }
  ];
}

module.exports = {
  getTestDefinitions
};
