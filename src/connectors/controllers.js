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
    logger.info({
      message: 'Redirecting to authorizeUrl',
    });
    logger.debug({
      message: 'Authorize URL generated',
      authorizeUrl,
    });
    respond.redirect(authorizeUrl);
  },
  userinfo: (tokenPromise) => {
    tokenPromise
      .then((token) => openid.getUserInfo(token))
      .then((userInfo) => {
        logger.debug({
          message: 'Resolved user infos',
          userInfo,
        });
        respond.success(userInfo);
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to provide user info',
          error: error.message || error,
        });
        respond.error(error);
      });
  },
  token: (code, state, host) => {
    logger.debug({
      message: 'Token controller called',
      code,
      state,
      host,
    });
    try {
      const memBefore = process.memoryUsage();
      logger.debug({
        message: 'Memory usage before token controller',
        memoryUsage: memBefore,
      });

      if (code) {
        logger.debug({
          message: 'Attempting to get tokens from GitHub',
          code,
        });
        openid
          .getTokens(code, state, host)
          .then((tokens) => {
            const memAfter = process.memoryUsage();
            logger.debug({
              message: 'Memory usage after successful token exchange',
              memoryUsage: memAfter,
            });
            logger.debug({
              message: 'Token exchange successful',
              tokens,
            });
            respond.success(tokens);
          })
          .catch((error) => {
            const memError = process.memoryUsage();
            logger.error({
              message: 'Memory usage at token exchange error',
              memoryUsage: memError,
            });
            logger.error({
              message: 'Token exchange failed',
              error: error.message || error,
            });
            respond.error(error);
          });
      } else {
        const memError = process.memoryUsage();
        logger.error({
          message: 'Memory usage at missing code error',
          memoryUsage: memError,
        });
        logger.error({
          message: 'No code supplied',
        });
        respond.error(new Error('No code supplied'));
      }
    } catch (error) {
      const memError = process.memoryUsage();
      logger.error({
        message: 'Memory usage at critical controller error',
        memoryUsage: memError,
      });
      logger.error({
        message: 'Critical error in token controller',
        error: error.message || error,
      });
      respond.error(error);
    }
  },
  jwks: () => {
    const jwks = openid.getJwks();
    logger.info({
      message: 'Providing access to JWKS',
      jwks,
    });
    respond.success(jwks);
  },
  openIdConfiguration: (host) => {
    const config = openid.getConfigFor(host);
    logger.info({
      message: 'Providing configuration',
      host,
      config,
    });
    respond.success(config);
  },
});
