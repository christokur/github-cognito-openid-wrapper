const controllers = require('../controllers');
const { handleError } = require('./util/error-handler');
const { validators } = require('../../errors');
const logger = require('../logger');

module.exports.handler = (event, context, callback) => {
  // Parameters are already validated by index.js
  const params = event.queryStringParameters || {};

  // Focus purely on business logic - generating GitHub OAuth URL
  return controllers().authorize(
    params.client_id,
    params.scope,
    params.state,
    params.response_type,
    params.code_challenge,
    params.code_challenge_method,
  );
};
