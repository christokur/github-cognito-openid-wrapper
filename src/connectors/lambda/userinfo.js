const controllers = require('../controllers');

module.exports.handler = async (event, context) => {
  // Token extracted and validated by index.js
  const params = event.queryStringParameters || {};
  const token = event.headers.Authorization?.replace('Bearer ', '');

  // Focus on fetching GitHub user data
  const response = await controllers().userinfo(token);
  return response;
};
