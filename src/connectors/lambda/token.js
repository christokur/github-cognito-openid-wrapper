const qs = require('querystring');
const responder = require('./util/responder');
const controllers = require('../controllers');
const { validators, handleError } = require('./util/error-handler');

const parseBody = (event) => {
  const contentType = event.headers['Content-Type'];
  if (event.body) {
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
      return qs.parse(event.body);
    }
    if (contentType.startsWith('application/json')) {
      return JSON.parse(event.body);
    }
  }
  return {};
};

module.exports.handler = (event, context, callback) => {
  try {
    // Extract and validate body parameters
    const body = JSON.parse(event.body || '{}');
    const code = validators.required(body.code, 'code');
    const client_id = validators.required(body.client_id, 'client_id');
    const client_secret = validators.required(body.client_secret, 'client_secret');
    const grant_type = validators.grant_type(body.grant_type);

    // Call the controller with validated parameters
    controllers(responder(callback)).token(
      code,
      client_id,
      client_secret,
      grant_type
    );
  } catch (error) {
    handleError(error, callback);
  }
};
