/* eslint-disable */
/* eslint-disable no-undef */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */

// Export mock values for tests to use in expectations
exports.mockValues = {
  GITHUB_CLIENT_ID: 'mock-client-id',
  GITHUB_CLIENT_SECRET: 'mock-client-secret',
  COGNITO_REDIRECT_URI: 'http://localhost/callback',
  GITHUB_API_URL: 'https://api.githube.com',
  GITHUB_LOGIN_URL: 'https://githube.com',
  GITHUB_DOCS_URL: 'https://docs.githube.com',
  PORT: '3000',
  COGNITO_JWKS_MAX_AGE: '3600',
  GITHUB_API_VERSION: 'v3',
  GITHUB_API_TIMEOUT: '10000',
  LOG_LEVEL: 'debug',
  // User mock values
  USER_LOGIN: 'octocat',
  USER_ID: 1,
  USER_AVATAR: 'octocat_happy.gif',
  USER_NAME: 'monalisa octocat',
  USER_EMAIL: 'octocat@github.com',
  USER_BLOG: 'blog',
  USER_UPDATED_AT: '2008-01-14T04:33:35Z',
};

let originalEnv;

beforeEach(() => {
  // Store original env
  originalEnv = { ...process.env };
  
  // Set mock environment variables
  Object.entries(exports.mockValues).forEach(([key, value]) => {
    process.env[key] = value;
  });
  const Configuration = require('./config');
});

afterEach(() => {
  // Restore original env
  process.env = originalEnv;
  jest.resetModules();
  delete require.cache[require.resolve('./config')];
  delete require.cache[require.resolve('./connectors/logger')];
});

jest.mock('./crypto', () => {
  const cryptoMock = {
    getPublicKey: jest.fn(() => ({
      alg: 'RS256',
      kid: 'jwtRS256',
      kty: 'RSA',
      e: 'AQAB',
      n: 'mocked_n_value',
    })),
    makeIdToken: jest.fn(() => 'mocked_id_token'),
    randomBytes: jest.fn((size) => Buffer.from('test-random-bytes')),
    createHash: jest.fn(() => ({
      update: jest.fn(),
      digest: jest.fn(() => Buffer.from('test-hash')),
    })),
  };

  return cryptoMock;
});
