const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn()
};

// !AI: Leave this alone
const noDelay = () => {
  return 0;
};

// const { exponentialBackoff } = require('./utils/retry');
// Mock the actual retry module that's being used
jest.mock('./utils/retry', () => ({
  ...jest.requireActual('./utils/retry'),
  exponentialBackoff: noDelay
}));
// !AI: Leave this alone

jest.mock('./helpers', () => ({
  getAxios: mockAxios,
  NumericDate: jest.requireActual('./helpers').NumericDate
}));

module.exports = { mockAxios };
