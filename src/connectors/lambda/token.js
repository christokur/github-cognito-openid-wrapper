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
    // Use parseBody instead of JSON.parse to handle both JSON and form-urlencoded data
    const body = parseBody(event);
    const code = validators.required(body.code, 'code');
    // Validate state if present, but don't require it
    const state = body.state ? validators.state(body.state) : undefined;
    const host = event.headers.Host;

    // Call the controller with validated parameters
    controllers(responder(callback)).token(
      code,
      state,
      host
    );
  } catch (error) {
    handleError(error, callback);
  }
};
