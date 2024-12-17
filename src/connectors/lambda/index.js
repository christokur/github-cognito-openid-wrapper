// Enable source map support if enabled via environment variable
const sourceMapSupport = process.env.SOURCE_MAP_SUPPORT;
if (sourceMapSupport && ['1', 'yes', 'true'].includes(sourceMapSupport.toLowerCase())) {
  require('source-map-support').install();
}

const VERSION = '1.3.16';
const VERSION_CONSUMER = process.env.VERSION_CONSUMER || '0.0.0';
const VERSION_COMPONENT = process.env.VERSION_COMPONENT || '0.0.0';

const authorize = require('./authorize');
const openIdConfiguration = require('./open-id-configuration');
const token = require('./token');
const userinfo = require('./userinfo');
const jwks = require('./jwks');

function logRequest(event, context) {
  console.log('Lambda Invocation:', JSON.stringify({
    version: VERSION,
    VERSION_CONSUMER: VERSION_CONSUMER,
    VERSION_COMPONENT: VERSION_COMPONENT,
    event: event,
    context: context
  }, null, 2));
}

exports.handler = async (event, context, callback) => {
  logRequest(event, context);
  
  const path = event.path || '';
  
  switch (path) {
    case '/authorize':
      return authorize.handler(event, context, callback);
    case '/.well-known/openid-configuration':
      return openIdConfiguration.handler(event, context, callback);
    case '/token':
      return token.handler(event, context, callback);
    case '/userinfo':
      return userinfo.handler(event, context, callback);
    case '/.well-known/jwks.json':
    case '/jwks.json':
      return jwks.handler(event, context, callback);
    default:
      callback(null, {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
  }
};
