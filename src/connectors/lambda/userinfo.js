const controllers = require('../controllers');

module.exports.handler = (event, context) => {
  // Token extracted and validated by index.js
  const params = event.queryStringParameters || {};
  const token = event.headers.Authorization?.replace('Bearer ', '');

  // Focus on fetching GitHub user data
  return controllers().userinfo(token);
};
