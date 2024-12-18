const logger = require('../logger');

module.exports = {
  getBearerToken: (req) => {
    try {
      // This method implements https://tools.ietf.org/html/rfc6750
      const authHeader = req.get('Authorization');
      if (authHeader) {
        // Section 2.1 Authorization request header
        // Should be of the form 'Bearer <token>'
        // We can ignore the 'Bearer ' bit
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          const error = new Error('Invalid Authorization header format');
          logger.error({
            message: 'Invalid Authorization header',
            header: authHeader
          });
          throw error;
        }
        return parts[1];
      } else if (req.query.access_token) {
        // Section 2.3 URI query parameter
        return req.query.access_token;
      } else if (
        req.get('Content-Type') === 'application/x-www-form-urlencoded'
      ) {
        // Section 2.2 form encoded body parameter
        return req.body.access_token;
      }
      const error = new Error('No token specified in request');
      logger.error({
        message: 'Missing access token',
        headers: req.headers
      });
      throw error;
    } catch (error) {
      logger.error({
        message: 'Failed to get bearer token',
        error: error.message || error
      });
      throw error;
    }
  },

  getIssuer: (host) => {
    if (!host) {
      logger.error({
        message: 'Missing host parameter'
      });
      throw new Error('Host parameter is required');
    }
    return `${host}`;
  },
};
