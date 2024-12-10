const responder = require('./util/responder');
const auth = require('./util/auth');
const controllers = require('../controllers');
const { validators, handleError } = require('./util/error-handler');

module.exports.handler = (event, context, callback) => {
  try {
    // Extract and validate query parameters
    const params = event.queryStringParameters || {};
    const client_id = validators.required(params.client_id, 'client_id');
    const scope = validators.scope(params.scope);
    const state = validators.state(params.state);
    const response_type = validators.response_type(params.response_type);

    // Call the controller with validated parameters
    controllers(responder(callback)).authorize(
      client_id,
      scope,
      state,
      response_type
    );
  } catch (error) {
    handleError(error, callback);
  }
};
