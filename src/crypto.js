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
  getPublicKey: () => {
    try {
      return {
        alg: config.JWT_ALGORITHM,
        kid: KEY_ID,
        ...JSONWebKey.fromPEM(pubKey).toJSON(),
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get public key',
        error: error.message || error
      });
      throw new Error('Failed to get public key: ' + (error.message || error));
    }
  },

  makeIdToken: (payload, host) => {
    try {
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
    } catch (error) {
      logger.error({
        message: 'Failed to create ID token',
        error: error.message || error
      });
      throw new Error('Failed to create ID token: ' + (error.message || error));
    }
  },
};
