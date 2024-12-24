const logger = require('../../logger');

module.exports = () => ({
  success: async (response) => {
    logger.info({
      message: 'Success response',
    });
    logger.debug({
      message: 'Response was: ',
      response,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  },
  error: async (err) => {
    logger.error({
      message: 'Error response',
      error: err.message || err,
    });
    const errorResponse = {
      error: err.type || 'server_error',
      error_description: err.message || 'An unexpected error occurred',
    };
    return {
      statusCode: err.statusCode || 400,
      body: JSON.stringify(errorResponse),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    };
  },
  redirect: async (url) => {
    logger.info({
      message: 'Redirect response',
    });
    logger.debug({
      message: 'Redirect response to',
      url,
    });
    return {
      statusCode: 302,
      headers: {
        Location: url,
      },
    };
  },
});
