const logger = require('../../logger');

module.exports = {
  getBearerToken: async (event) => {
    try {
      // This method implements https://tools.ietf.org/html/rfc6750
      const authHeader = event.headers
        ? event.headers.Authorization || event.headers.authorization
        : null;
      if (authHeader) {
        // Section 2.1 Authorization request header
        // Should be of the form 'Bearer <token>'
        // We can ignore the 'Bearer ' bit
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          const error = new Error('Invalid Authorization header format');
          logger.error({
            message: 'Invalid Authorization header',
            header: authHeader,
          });
          throw error;
        }
        return parts[1];
      }
      if (
        event.queryStringParameters &&
        event.queryStringParameters.access_token
      ) {
        // Section 2.3 URI query parameter
        return event.queryStringParameters.access_token;
      }
      if (
        event.headers &&
        (event.headers['Content-Type'] ===
          'application/x-www-form-urlencoded' ||
          event.headers['content-type'] ===
            'application/x-www-form-urlencoded') &&
        event.body
      ) {
        // Section 2.2 form encoded body parameter
        const body =
          typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        return body.access_token;
      }
      const error = new Error('No token specified in request');
      logger.error({
        message: 'Missing access token',
        event: {
          headers: event.headers,
          queryStringParameters: event.queryStringParameters,
        },
      });
      throw error;
    } catch (error) {
      logger.error({
        message: 'Error getting bearer token',
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },

  getIssuer: async (host) => {
    if (!host) {
      throw new Error('No host header in request');
    }
    return `https://${host}`;
  },
};
