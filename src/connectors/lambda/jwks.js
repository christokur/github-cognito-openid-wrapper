const controllers = require('../controllers');

module.exports.handler = (event, context) =>
  // No parameters needed, just return public keys
   controllers().jwks()
;
