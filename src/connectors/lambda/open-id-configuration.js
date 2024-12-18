const controllers = require('../controllers');

module.exports.handler = (event, context, callback) => {
  try {
    // Get the host from the event headers
    const host = event.headers && event.headers.Host;
    if (!host) {
      return callback(null, {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Host header is required'
        })
      });
    }
    //  if host already has a `http?://` prefix do nothing else add it
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = `https://${host}`;
    }
    const response = controllers(callback).openIdConfiguration(host);
    return callback(null, response);
  } catch (error) {
    return callback(null, {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: error.message || 'Internal server error'
      })
    });
  }
};
