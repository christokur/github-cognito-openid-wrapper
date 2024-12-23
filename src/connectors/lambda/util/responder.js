const logger = require('../../logger');

module.exports = (callback) => ({
  success: (response) => {
    logger.info({
      message: 'Success response',
    });
    logger.debug({
      message: 'Response was: ',
      response,
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
      error: err.message || err,
    });
    const errorResponse = {
      error: err.type || 'server_error',
      error_description: err.message || 'An unexpected error occurred',
    };
    callback(null, {
      statusCode: err.statusCode || 400,
      body: JSON.stringify(errorResponse),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  },
  redirect: (url) => {
    logger.info({
      message: 'Redirect response',
    });
    logger.debug({
      message: 'Redirect response to',
      url,
    });
    callback(null, {
      statusCode: 302,
      headers: {
        Location: url,
      },
    });
  },
});
