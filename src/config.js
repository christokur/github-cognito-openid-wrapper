module.exports = {
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  COGNITO_REDIRECT_URI: process.env.COGNITO_REDIRECT_URI,
  GITHUB_API_URL: process.env.GITHUB_API_URL || 'https://api.github.com', // Fallback to default URL
  GITHUB_LOGIN_URL: process.env.GITHUB_LOGIN_URL,
  PORT: parseInt(process.env.PORT, 10) || undefined,

  // JWT key configuration
  JWT_KEY_ID: process.env.JWT_KEY_ID || 'jwtRS256',
  JWT_PRIVATE_KEY_PATH: process.env.JWT_PRIVATE_KEY_PATH || '../jwtRS256.key',
  JWT_PUBLIC_KEY_PATH: process.env.JWT_PUBLIC_KEY_PATH || '../jwtRS256.key.pub',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'RS256',

  // Splunk logging variables
  SPLUNK_URL: process.env.SPLUNK_URL,
  SPLUNK_TOKEN: process.env.SPLUNK_TOKEN,
  SPLUNK_SOURCE: process.env.SPLUNK_SOURCE,
  SPLUNK_SOURCETYPE: process.env.SPLUNK_SOURCETYPE,
  SPLUNK_INDEX: process.env.SPLUNK_INDEX,
};
