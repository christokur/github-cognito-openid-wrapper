const controllers = require('../controllers');
const { getHeaderCaseInsensitive } = require('./request-utils');
const logger = require('../logger');

module.exports.handler = async (event, context) => {
  // Token extracted and validated by index.js
  const params = event.queryStringParameters || {};
  const authHeader = getHeaderCaseInsensitive(event.headers || {}, 'Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  logger.debug('Processing /userinfo request', {
    token: token ? '***' : 'none',
    params
  });

  try {
    const response = await controllers().userinfo(token);
    
    logger.debug('Successfully processed /userinfo request', {
      statusCode: response.statusCode,
      body: response.body
    });
    
    return response;
  } catch (error) {
    logger.error('Error processing /userinfo request', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
