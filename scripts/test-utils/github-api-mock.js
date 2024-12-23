const logger = require('../../src/connectors/logger');
const Configuration = require('../../src/config');
const { OAuthError, errorTypes } = require('../../src/errors');

// Create a mock function
const createMockFn = (implementation) => {
  const fn = (...args) => implementation(...args);
  fn.calls = [];
  fn.mockImplementation = (newImpl) => {
    fn.implementation = newImpl;
    return fn;
  };
  return fn;
};

const mockAxios = {
  create: () => ({
    timeout: Configuration.GITHUB_API_TIMEOUT,
    get: createMockFn((url, config) => {
      logger.debug({ message: 'Mock axios GET request', url, config });

      if (url.endsWith('/user')) {
        return Promise.resolve({
          status: 200,
          headers: {
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': '4999',
          },
          data: {
            id: 12345,
            login: 'test-user',
            name: 'Test User',
            email: 'test@example.com',
          },
        });
      }

      if (url.endsWith('/user/emails')) {
        return Promise.resolve({
          status: 200,
          headers: {
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': '4999',
          },
          data: [
            {
              email: 'test@example.com',
              primary: true,
              verified: true,
            },
          ],
        });
      }

      const error = new Error(`Mock: Unexpected URL ${url}`);
      error.response = {
        status: 404,
        statusText: 'Not Found',
        data: {
          message: `No mock implemented for ${url}`,
        },
      };
      return Promise.reject(error);
    }),
    post: createMockFn((url, data) => {
      logger.debug({ message: 'Mock axios POST request', url, data });

      if (url.endsWith('/login/oauth/access_token')) {
        // Validate request
        if (!data || typeof data !== 'object') {
          const error = new Error('Request body is required');
          error.response = {
            status: 400,
            statusText: 'Bad Request',
            data: {
              error: errorTypes.INVALID_REQUEST,
              error_description: 'Request body is required',
            },
          };
          return Promise.reject(error);
        }

        // Check required fields
        const requiredFields = ['client_id', 'client_secret', 'code', 'grant_type'];
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
          const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
          error.response = {
            status: 400,
            statusText: 'Bad Request',
            data: {
              error: errorTypes.INVALID_REQUEST,
              error_description: `Missing required fields: ${missingFields.join(', ')}`,
            },
          };
          return Promise.reject(error);
        }

        // Validate grant_type
        if (data.grant_type !== 'authorization_code') {
          const error = new Error('Invalid grant_type');
          error.response = {
            status: 400,
            statusText: 'Bad Request',
            data: {
              error: errorTypes.INVALID_REQUEST,
              error_description: 'Invalid grant_type, must be "authorization_code"',
            },
          };
          return Promise.reject(error);
        }

        return Promise.resolve({
          status: 200,
          data: {
            access_token: 'mock-access-token',
            token_type: 'bearer',
            scope: 'user,user:email',
          },
        });
      }

      const error = new Error(`Mock: Unexpected URL ${url}`);
      error.response = {
        status: 404,
        statusText: 'Not Found',
        data: {
          message: `No mock implemented for ${url}`,
        },
      };
      return Promise.reject(error);
    }),
  }),
};

const helpers = require('../../src/helpers');
helpers.getAxios = () => mockAxios.create();

module.exports = {
  getAxios: () => mockAxios.create(),
};
