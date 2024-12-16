const logger = require('./logger');
const openid = require('../openid');

module.exports = (respond) => ({
  authorize: (client_id, scope, state, response_type) => {
    const authorizeUrl = openid.getAuthorizeUrl(
      client_id,
      scope,
      state,
      response_type,
    );
    logger.info('Redirecting to authorizeUrl');
    logger.debug('Authorize Url is: %s', authorizeUrl, {});
    respond.redirect(authorizeUrl);
  },
  userinfo: (tokenPromise) => {
    tokenPromise
      .then((token) => openid.getUserInfo(token))
      .then((userInfo) => {
        logger.debug('Resolved user infos:', userInfo, {});
        respond.success(userInfo);
      })
      .catch((error) => {
        logger.error(
          'Failed to provide user info: %s',
          error.message || error,
          {},
        );
        respond.error(error);
      });
  },
  token: (code, state, host) => {
    logger.debug('Token controller called with code: %s, state: %s, host: %s', code, state, host, {});
    if (code) {
      logger.debug('Attempting to get tokens from GitHub', {});
      openid
        .getTokens(code, state, host)
        .then((tokens) => {
          logger.debug(
            'Token exchange successful. Response: %j',
            tokens,
            {},
          );
          respond.success(tokens);
        })
        .catch((error) => {
          logger.error(
            'Token exchange failed: %s',
            error.message || error,
            {},
          );
          respond.error(error);
        });
    } else {
      const error = new Error('No code supplied');
      logger.error(
        'Token exchange failed: %s',
        error.message || error,
        {},
      );
      respond.error(error);
    }
  },
  jwks: () => {
    const jwks = openid.getJwks();
    logger.info('Providing access to JWKS: %j', jwks, {});
    respond.success(jwks);
  },
  openIdConfiguration: (host) => {
    const config = openid.getConfigFor(host);
    logger.info('Providing configuration for %s: %j', host, config, {});
    respond.success(config);
  },
});
