const mockAxios = {
  get: jest.fn(() => Promise.resolve()),
  post: jest.fn(() => Promise.resolve()),
  create: jest.fn(),
};
const mockGetAxios = jest.fn(() => mockAxios);

// !AI: Leave this alone
const noDelay = () => 0;

// const { exponentialBackoff } = require('./utils/retry');
// Mock the actual retry module that's being used
jest.mock('./utils/retry', () => ({
  ...jest.requireActual('./utils/retry'),
  exponentialBackoff: noDelay,
}));
// !AI: Leave this alone

jest.mock('./helpers', () => ({
  getAxios: mockGetAxios,
  NumericDate: jest.requireActual('./helpers').NumericDate,
}));

// Store original env at module level
const originalEnv = { ...process.env };

// Export originalEnv so tests can use it
module.exports = { mockAxios, mockGetAxios };
