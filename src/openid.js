const logger = require('./connectors/logger');
const { NumericDate } = require('./helpers');
const crypto = require('./crypto');
const githubClient = require('./github');
const config = require('./config');

const getJwks = () => ({ keys: [crypto.getPublicKey()] });

/**
 * Fetches user information from GitHub and returns the OpenID claims.
 *
 * @param {string} accessToken - The access token to use for authentication.
 * @returns {Promise<Object>} A promise that resolves to the OpenID claims.
 */
const getUserInfo = (accessToken) => {
  const githubClientInstance = githubClient(
    config.GITHUB_API_URL,
    config.GITHUB_LOGIN_URL,
  );
  return githubClientInstance
    .getUserDetails(accessToken)
    .then((userDetails) => {
      logger.debug({
        message: 'Fetched user details',
        userDetails,
      });
      // Here we map the github user response to the standard claims from
      // OpenID. The mapping was constructed by following
      // https://developer.github.com/v3/users/
      // and http://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
      const claims = {
        sub: `${userDetails.id}`, // OpenID requires a string
        name: userDetails.name,
        preferred_username: userDetails.login,
        profile: userDetails.html_url,
        picture: userDetails.avatar_url,
        website: userDetails.blog,
        updated_at: NumericDate(
          // OpenID requires the seconds since epoch in UTC
          new Date(Date.parse(userDetails.updated_at)),
        ),
      };
      logger.debug({
        message: 'Resolved claims',
        claims,
      });
      return Promise.all([
        Promise.resolve(claims),
        githubClientInstance.getUserEmails(accessToken).then((userEmails) => {
          logger.debug({
            message: 'Fetched user emails',
            userEmails,
          });
          const primaryEmail = userEmails.find((email) => email.primary);
          if (primaryEmail === undefined) {
            throw new Error('User did not have a primary email address');
          }
          return {
            email: primaryEmail.email,
            email_verified: primaryEmail.verified,
          };
        }),
      ]).then(([userClaims, emailClaims]) => ({
        ...userClaims,
        ...emailClaims,
      }));
    })
    .catch((error) => {
      logger.error({
        message: 'Failed to fetch user info',
        error,
      });
      throw error;
    });
};

const getAuthorizeUrl = (client_id, scope, state, response_type) =>
  githubClient(config.GITHUB_API_URL, config.GITHUB_LOGIN_URL).getAuthorizeUrl(
    client_id,
    scope,
    state,
    response_type,
  );

const getTokens = (code, state, host) => {
  logger.debug({
    message: 'Getting tokens',
    code,
    state,
    host,
    memoryUsage: process.memoryUsage(),
  });
  
  const memBefore = process.memoryUsage();
  logger.debug({
    message: 'Memory usage before GitHub token flow',
    memBefore,
  });
  
  try {
    return githubClient(config.GITHUB_API_URL, config.GITHUB_LOGIN_URL)
      .getToken(code, state)
      .then((githubToken) => {
        const memAfter = process.memoryUsage();
        logger.debug({
          message: 'Memory usage after GitHub token response',
          memAfter,
        });
        logger.debug({
          message: 'Got GitHub token response',
          githubToken,
        });
        
        // GitHub returns scopes separated by commas
        // But OAuth wants them to be spaces
        // https://tools.ietf.org/html/rfc6749#section-5.1
        // Also, we need to add openid as a scope,
        // since GitHub will have stripped it
        const scope = `openid ${githubToken.scope.replace(/,/g, ' ')}`;

        // ** JWT ID Token required fields **
        // iss - issuer https url
        // aud - audience that this token is valid for (GITHUB_CLIENT_ID)
        // sub - subject identifier - must be unique
        // ** Also required, but provided by jsonwebtoken **
        // exp - expiry time for the id token (seconds since epoch in UTC)
        // iat - time that the JWT was issued (seconds since epoch in UTC)

        return new Promise((resolve, reject) => {
          try {
            const memBefore = process.memoryUsage();
            logger.debug({
              message: 'Memory usage before ID token creation',
              memBefore,
            });
            
            const payload = {
              // This was commented because Cognito times out in under a second
              // and generating the userInfo takes too long.
              // It means the ID token is empty except for metadata.
              //  ...userInfo,
            };

            logger.debug({
              message: 'Creating ID token with payload',
              payload,
            });
            const idToken = crypto.makeIdToken(payload, host);
            const tokenResponse = {
              ...githubToken,
              scope,
              id_token: idToken,
            };

            const memAfter = process.memoryUsage();
            logger.debug({
              message: 'Memory usage after ID token creation',
              memAfter,
            });
            logger.debug({
              message: 'Final token response',
              tokenResponse,
            });
            resolve(tokenResponse);
          } catch (err) {
            logger.error({
              message: 'Error while creating ID token',
              err,
            });
            const memError = process.memoryUsage();
            logger.error({
              message: 'Memory usage at ID token error',
              memError,
            });
            reject(err);
          }  
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed in GitHub token flow',
          error,
        });
        const memError = process.memoryUsage();
        logger.error({
          message: 'Memory usage at GitHub token error',
          memError,
        });
        throw error;
      });
  } catch (error) {
    logger.error({
      message: 'Critical error in token flow',
      error,
    });
    const memError = process.memoryUsage();
    logger.error({
      message: 'Memory usage at critical error',
      memError,
    });
    throw error;
  }
};

const getConfigFor = (host) => ({
  issuer: `https://${host}`,
  authorization_endpoint: `https://${host}/authorize`,
  token_endpoint: `https://${host}/token`,
  token_endpoint_auth_methods_supported: [
    'client_secret_basic',
    'private_key_jwt',
  ],
  token_endpoint_auth_signing_alg_values_supported: ['RS256'],
  userinfo_endpoint: `https://${host}/userinfo`,
  // check_session_iframe: 'https://server.example.com/connect/check_session',
  // end_session_endpoint: 'https://server.example.com/connect/end_session',
  jwks_uri: `https://${host}/.well-known/jwks.json`,
  // registration_endpoint: 'https://server.example.com/connect/register',
  scopes_supported: ['openid', 'read:user', 'user:email'],
  response_types_supported: [
    'code',
    'code id_token',
    'id_token',
    'token id_token',
  ],

  subject_types_supported: ['public'],
  userinfo_signing_alg_values_supported: ['none'],
  id_token_signing_alg_values_supported: ['RS256'],
  request_object_signing_alg_values_supported: ['none'],
  display_values_supported: ['page', 'popup'],
  claims_supported: [
    'sub',
    'name',
    'preferred_username',
    'profile',
    'picture',
    'website',
    'email',
    'email_verified',
    'updated_at',
    'iss',
    'aud',
  ],
});

module.exports = {
  getTokens,
  getUserInfo,
  getJwks,
  getConfigFor,
  getAuthorizeUrl,
};
