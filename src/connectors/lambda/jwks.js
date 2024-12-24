const controllers = require('../controllers');

module.exports.handler = async (event, context) => {
  // No parameters needed, just return public keys
  const response = await controllers().jwks();
  return response;
};
