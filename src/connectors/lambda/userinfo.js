const responder = require('./util/responder');
const controllers = require('../controllers');
const { validators, handleError } = require('./util/error-handler');

module.exports.handler = (event, context, callback) => {
  try {
    // Extract and validate authorization header
    const authHeader = event.headers.Authorization || '';
    const token = validators.required(
      authHeader.replace('Bearer ', ''),
      'access_token'
    );

    // Call the controller with validated token
    controllers(responder(callback)).userinfo(token);
  } catch (error) {
    handleError(error, callback);
  }
};
