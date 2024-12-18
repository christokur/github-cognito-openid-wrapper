const controllers = require('../controllers');

module.exports.handler = (event, context, callback) => {
  // No parameters needed, just return OIDC configuration
  controllers(callback).openIdConfiguration();
};
