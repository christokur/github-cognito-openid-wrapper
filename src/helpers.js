const config = require('./config');

const NumericDate = (date) => Math.floor(date / 1000);

const ensureString = (variableName) => {
  const value = config[variableName];
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(
      `Environment variable ${String(variableName)} must be set and be a string`,
    );
  }
};

const ensureNumber = (variableName) => {
  const value = config[variableName];
  if (value !== undefined && typeof value !== 'number') {
    throw new Error(
      `Environment variable ${String(variableName)} must be set and be a number`,
    );
  }
};

const requiredStrings = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'COGNITO_REDIRECT_URI',
];

const requiredNumbers = ['PORT'];

const validateConfig = () => {
  requiredStrings.forEach(ensureString);
  requiredNumbers.forEach(ensureNumber);
};

module.exports = {
  NumericDate,
  ensureString,
  ensureNumber,
  validateConfig,
};
