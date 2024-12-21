const controllers = require('../controllers');

module.exports.handler = (event, context, callback) => {
  try {
    // Get the host from the event headers
    let host = event.headers && event.headers.Host;
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
    return controllers().openIdConfiguration(host);
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: error.message || 'Internal server error'
      })
    };
  }
};
