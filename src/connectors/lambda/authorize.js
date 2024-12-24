const controllers = require('../controllers');
const { validators } = require('../../errors');
const logger = require('../logger');

module.exports.handler = async (event, context) => {
  // Parameters are already validated by index.js
  const params = event.queryStringParameters || {};

  // Focus purely on business logic - generating GitHub OAuth URL
  const response = await controllers().authorize(
    params.client_id,
    params.scope,
    params.state,
    params.response_type,
    params.code_challenge,
    params.code_challenge_method,
  );
  return response;
};
