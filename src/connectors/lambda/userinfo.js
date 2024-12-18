const controllers = require('../controllers');

module.exports.handler = (event, context, callback) => {
  // Token extracted and validated by index.js
  const params = event.queryStringParameters || {};
  const token = event.headers.Authorization?.replace('Bearer ', '');
  
  // Focus on fetching GitHub user data
  controllers(callback).userinfo(token);
};
