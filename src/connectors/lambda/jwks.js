const controllers = require('../controllers');

module.exports.handler = (event, context, callback) => {
  // No parameters needed, just return public keys
  callback(null, controllers(callback).jwks());
};
