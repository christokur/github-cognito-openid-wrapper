const JSONWebKey = require('json-web-key');
const jwt = require('jsonwebtoken');
const config = require('./config');
const logger = require('./connectors/logger');
const defaultPrivateKey = require('../jwtRS256.key');
const defaultPublicKey = require('../jwtRS256.key.pub');

const KEY_ID = config.JWT_KEY_ID;
const cert = config.JWT_PRIVATE_KEY_PATH === '../jwtRS256.key' ? defaultPrivateKey : require(config.JWT_PRIVATE_KEY_PATH);
const pubKey = config.JWT_PUBLIC_KEY_PATH === '../jwtRS256.key.pub' ? defaultPublicKey : require(config.JWT_PUBLIC_KEY_PATH);

module.exports = {
  getPublicKey: () => ({
    alg: config.JWT_ALGORITHM,
    kid: KEY_ID,
    ...JSONWebKey.fromPEM(pubKey).toJSON(),
  }),

  makeIdToken: (payload, host) => {
    const enrichedPayload = {
      ...payload,
      iss: `https://${host}`,
      aud: config.GITHUB_CLIENT_ID,
    };
    logger.debug({
      message: 'Signing payload',
      payload: enrichedPayload
    });
    return jwt.sign(enrichedPayload, cert, {
      expiresIn: '1h',
      algorithm: config.JWT_ALGORITHM,
      keyid: KEY_ID,
    });
  },
};
