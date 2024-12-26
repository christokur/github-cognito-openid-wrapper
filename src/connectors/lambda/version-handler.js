const { VERSION } = require('./version');
const { formatResponse } = require('./response-utils');

// List of environment variables that should be exposed
const ALLOWED_ENV_VARS = [
  'VERSION_COMPONENT',
  'GITHUB_API_URL',
  'VERSION_CONSUMER',
  'GITHUB_LOGIN_URL',
  'CONSUMER',
  'COGNITO_REDIRECT_URI',
  'LOG_LEVEL',
  'SOURCE_MAP_SUPPORT'
];

// Function to get safe environment variables
const getSafeEnvironment = () => {
  const safeEnv = {};
  ALLOWED_ENV_VARS.forEach(key => {
    if (process.env[key]) {
      safeEnv[key] = process.env[key];
    }
  });
  return safeEnv;
};

const handler = () => formatResponse({
  statusCode: 200,
  body: JSON.stringify({
    version: VERSION,
    environment: getSafeEnvironment()
  })
});

module.exports = {
  handler,
};
