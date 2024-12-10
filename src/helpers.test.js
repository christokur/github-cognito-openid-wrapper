const {
  validateConfig,
  NumericDate,
  ensureString,
  ensureNumber,
} = require('./helpers');
const config = require('./config');

beforeAll(() => {
  process.env.GITHUB_CLIENT_SECRET = 'some-secret';
  process.env.SOME_NUMBER = '123';
});

beforeEach(() => {
  jest.resetModules();
  config.GITHUB_CLIENT_ID = 'test-client-id';
  config.GITHUB_CLIENT_SECRET = 12345; // Intentional type error for testing
  config.COGNITO_REDIRECT_URI = 'http://localhost';
  config.COGNITO_JWKS_MAX_AGE = 'not-a-number'; // Set the number field we're testing
  config.SOME_NUMBER = 'not-a-number'; // Intentional type error for testing
});

describe('validateConfig', () => {
  it('should throw an error if configuration is invalid', () => {
    expect(() => validateConfig()).toThrow(
      'Environment variable GITHUB_CLIENT_SECRET must be set and be a string',
    );
  });

  test('should validate required number configuration', () => {
    expect(() => {
      validateConfig();
    }).toThrow('COGNITO_JWKS_MAX_AGE must be a number');
  });
});

describe('NumericDate', () => {
  it('should convert milliseconds to seconds', () => {
    expect(NumericDate(1000)).toBe(1);
    expect(NumericDate(1500)).toBe(1);
    expect(NumericDate(2000)).toBe(2);
  });
});

describe('ensureString', () => {
  it('should throw an error if the variable is not a string', () => {
    expect(() => ensureString('GITHUB_CLIENT_SECRET')).toThrow(
      'Environment variable GITHUB_CLIENT_SECRET must be set and be a string',
    );
  });
});

describe('ensureNumber', () => {
  it('should throw an error if the variable is not a number', () => {
    expect(() => ensureNumber('SOME_NUMBER')).toThrow(
      'Environment variable SOME_NUMBER must be set and be a number',
    );
  });
});
