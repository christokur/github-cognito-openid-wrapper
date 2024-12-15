const authorize = require('./authorize');
const openIdConfiguration = require('./open-id-configuration');
const token = require('./token');
const userinfo = require('./userinfo');
const jwks = require('./jwks');

function logRequest(event, context) {
  const logData = {
    requestId: context.awsRequestId,
    path: event.path || '',
    method: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
    requestTimeEpoch: event.requestContext?.requestTimeEpoch,
    sourceIp: event.requestContext?.identity?.sourceIp,
    userAgent: event.requestContext?.identity?.userAgent,
    functionVersion: context.functionVersion,
    functionName: context.functionName,
    memoryLimitInMB: context.memoryLimitInMB,
    remainingTime: context.getRemainingTimeInMillis(),
  };

  console.log('Lambda Invocation:', JSON.stringify(logData, null, 2));
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
