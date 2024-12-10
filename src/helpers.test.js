const NumericDate = require('./helpers').NumericDate;

beforeEach(() => {
  jest.resetModules();
  delete require.cache[require.resolve('./config')];
  delete require.cache[require.resolve('./helpers')];
  // Clear relevant env vars
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.COGNITO_REDIRECT_URI;
  delete process.env.COGNITO_JWKS_MAX_AGE;
  delete process.env.SOME_NUMBER;
  delete process.env.PORT;
});

describe('validateConfig', () => {
  it('should throw an error if configuration is invalid', () => {
    // Only set GITHUB_CLIENT_ID to make GITHUB_CLIENT_SECRET fail
    process.env.GITHUB_CLIENT_ID = 'test_client_id';
    const { validateConfig } = require('./helpers');
    expect(() => validateConfig()).toThrow(
      'Environment variable GITHUB_CLIENT_SECRET must be set and be a string'
    );
  });

  test('should validate required number configuration', () => {
    // First set all required string variables
    process.env.GITHUB_CLIENT_ID = 'test_client_id';
    process.env.GITHUB_CLIENT_SECRET = 'test_client_secret';
    process.env.COGNITO_REDIRECT_URI = 'http://localhost/callback';
    process.env.PORT = '8080'; // Set PORT to a valid number
    process.env.COGNITO_JWKS_MAX_AGE = 'not_a_number'; // This should trigger the number validation error

    const { validateConfig } = require('./helpers');
    expect(() => validateConfig()).toThrow(
      'Environment variable COGNITO_JWKS_MAX_AGE must be set and be a number'
    );
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
    // Set up config with non-string value
    process.env.GITHUB_CLIENT_SECRET = '12345';
    const config = require('./config');
    config.GITHUB_CLIENT_SECRET = 12345; // Directly modify to be a number
    const { ensureString } = require('./helpers');
    expect(() => ensureString('GITHUB_CLIENT_SECRET')).toThrow(
      'Environment variable GITHUB_CLIENT_SECRET must be set and be a string'
    );
  });
});

describe('ensureNumber', () => {
  it('should throw an error if the variable is not a valid number', () => {
    process.env.PORT = 'not-a-number';
    const { ensureNumber } = require('./helpers');
    expect(() => ensureNumber('PORT')).toThrow(
      'Environment variable PORT must be set and be a number'
    );
  });

  it('should not throw if the variable is a valid number string', () => {
    process.env.PORT = '123';
    const { ensureNumber } = require('./helpers');
    expect(() => ensureNumber('PORT')).not.toThrow();
  });
});

describe('ensureNumber SOME_NUMBER', () => {
  it('should throw an error if the variable is not a valid number', () => {
    const config = require('./config');
    config.SOME_NUMBER = 'not-a-number';
    const { ensureNumber } = require('./helpers');
    expect(() => ensureNumber('SOME_NUMBER')).toThrow(
      'Environment variable SOME_NUMBER must be set and be a number'
    );
  });
});
