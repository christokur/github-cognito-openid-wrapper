class Configuration {
  constructor() {
    if (!Configuration.instance) {
      this.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
      this.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
      this.COGNITO_REDIRECT_URI = process.env.COGNITO_REDIRECT_URI;
      this.GITHUB_API_URL = process.env.GITHUB_API_URL;
      this.GITHUB_LOGIN_URL = process.env.GITHUB_LOGIN_URL;
      this.PORT = parseInt(process.env.PORT, 10) || undefined;

      // GitHub API configuration
      this.GITHUB_API_TIMEOUT =
        parseInt(process.env.GITHUB_API_TIMEOUT, 10) || 10000;
      this.GITHUB_API_VERSION = process.env.GITHUB_API_VERSION || 'v3';

      // JWT key configuration
      this.JWT_KEY_ID = process.env.JWT_KEY_ID || 'jwtRS256';
      this.JWT_PRIVATE_KEY_PATH =
        process.env.JWT_PRIVATE_KEY_PATH || '../jwtRS256.key';
      this.JWT_PUBLIC_KEY_PATH =
        process.env.JWT_PUBLIC_KEY_PATH || '../jwtRS256.key.pub';
      this.JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'RS256';

      // Splunk logging variables
      this.SPLUNK_URL = process.env.SPLUNK_URL;
      this.SPLUNK_TOKEN = process.env.SPLUNK_TOKEN;
      this.SPLUNK_SOURCE = process.env.SPLUNK_SOURCE;
      this.SPLUNK_SOURCETYPE = process.env.SPLUNK_SOURCETYPE;
      this.SPLUNK_INDEX = process.env.SPLUNK_INDEX;

      Configuration.instance = this;
    }

    return Configuration.instance;
  }
}

// Export the singleton instance
const configuration = new Configuration();
Object.freeze(configuration);
module.exports = configuration;
