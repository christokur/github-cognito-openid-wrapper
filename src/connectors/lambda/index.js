const authorize = require('./authorize');
const openIdConfiguration = require('./openIdConfiguration');
const token = require('./token');
const userinfo = require('./userinfo');
const jwks = require('./jwks');

exports.handler = async (event, context, callback) => {
  const path = event.path || '';
  
  // Strip /prod prefix if present
  const cleanPath = path.replace(/^\/prod/, '');

  switch (cleanPath) {
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
