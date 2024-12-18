const controllers = require('../controllers');

module.exports.handler = (event, context, callback) => {
  // Parameters are already validated by index.js
  const params = event.queryStringParameters || {};
  
  // Focus purely on business logic - generating GitHub OAuth URL
  controllers(callback).authorize(
    params.client_id,
    params.scope,
    params.state,
    params.response_type,
    params.code_challenge,
    params.code_challenge_method
  );
};
