const { VERSION } = require('./version');
const { formatResponse } = require('./response-utils');

// List of environment variables that should not be exposed
const SENSITIVE_ENV_VARS = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];

// Function to get safe environment variables
const getSafeEnvironment = () => {
  const safeEnv = {};
  Object.keys(process.env).forEach(key => {
    if (!SENSITIVE_ENV_VARS.includes(key)) {
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
