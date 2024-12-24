const controllers = require('../controllers');
const { getHeaderCaseInsensitive } = require('./request-utils');

module.exports.handler = async (event, context) => {
  // Token extracted and validated by index.js
  const params = event.queryStringParameters || {};
  const authHeader = getHeaderCaseInsensitive(event.headers || {}, 'Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  // Focus on fetching GitHub user data
  const response = await controllers().userinfo(token);
  return response;
};
