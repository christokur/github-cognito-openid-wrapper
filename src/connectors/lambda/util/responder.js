const logger = require('../../logger');

module.exports = (callback) => ({
  success: (response) => {
    logger.info({
      message: 'Success response'
    });
    logger.debug({
      message: 'Response was: ',
      response
    });
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  error: (err) => {
    logger.error({
      message: 'Error response',
      error: err.message || err
    });
    callback(null, {
      statusCode: 400,
      body: JSON.stringify(err.message),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  redirect: (url) => {
    logger.info({
      message: 'Redirect response'
    });
    logger.debug({
      message: 'Redirect response to',
      url
    });
    callback(null, {
      statusCode: 302,
      headers: {
        Location: url,
      },
    });
  },
});
