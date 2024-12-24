const fs = require('fs');

let crypto;
let config;
let JSONWebKey;
let jwt;
let mockJwtSign;

// Mock key content
const mockPublicKey =
  '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----';
const mockPrivateKey =
  '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAA\n-----END PRIVATE KEY-----';

// Mock the mock key files that crypto.js falls back to
jest.mock('./__mocks__/privateKeyMock.js', () => mockPrivateKey, {
  virtual: true,
});
jest.mock('./__mocks__/publicKeyMock.js', () => mockPublicKey, {
  virtual: true,
});

describe('Crypto', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock fs.existsSync to control whether real key files exist
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);

    // Mock JSONWebKey
    jest.mock('json-web-key', () => ({
      fromPEM: jest.fn().mockReturnValue({
        toJSON: () => ({
          kty: 'RSA',
          n: 'test-modulus',
          e: 'test-exponent',
        }),
      }),
    }));

    // Mock jsonwebtoken
    mockJwtSign = jest.fn().mockReturnValue('test.jwt.token');
    jest.mock('jsonwebtoken', () => ({
      sign: mockJwtSign,
    }));

    // Mock config with paths that crypto.js will try to require
    jest.mock('./config', () => ({
      JWT_ALGORITHM: 'RS256',
      JWT_KEY_ID: 'test-key-id',
      GITHUB_CLIENT_ID: 'test-client-id',
      JWT_PRIVATE_KEY_PATH: './__mocks__/privateKeyMock.js',
      JWT_PUBLIC_KEY_PATH: './__mocks__/publicKeyMock.js',
    }));

    // Load modules after mocks are set up
    config = require('./config');
    crypto = require('./crypto');
    JSONWebKey = require('json-web-key');
    jwt = require('jsonwebtoken');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./crypto')];
    delete require.cache[require.resolve('./config')];
    delete require.cache[require.resolve('./__mocks__/privateKeyMock.js')];
    delete require.cache[require.resolve('./__mocks__/publicKeyMock.js')];
    delete require.cache[require.resolve('./connectors/logger')];
    delete require.cache[require.resolve('json-web-key')];
    delete require.cache[require.resolve('jsonwebtoken')];
  });

  describe('getPublicKey', () => {
    it('should return public key in JWK format', () => {
      const result = crypto.getPublicKey();

      expect(JSONWebKey.fromPEM).toHaveBeenCalledWith(mockPublicKey);
      expect(result).toEqual({
        alg: 'RS256',
        kid: 'test-key-id',
        kty: 'RSA',
        n: 'test-modulus',
        e: 'test-exponent',
      });
    });

    it('should handle errors when getting public key', () => {
      JSONWebKey.fromPEM.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      expect(() => crypto.getPublicKey()).toThrow(
        'Failed to get public key: Test error',
      );
    });

    it('should handle missing key files', () => {
      fs.existsSync.mockReturnValue(false);
      const result = crypto.getPublicKey();

      expect(result).toEqual({
        alg: 'RS256',
        kid: 'test-key-id',
        kty: 'RSA',
        n: 'test-modulus',
        e: 'test-exponent',
      });
    });
  });

  describe('makeIdToken', () => {
    const payload = {
      sub: 'test-subject',
      name: 'Test User',
    };
    const host = 'test.host.com';

    it('should create a signed JWT token', () => {
      const result = crypto.makeIdToken(payload, host);

      expect(mockJwtSign).toHaveBeenCalledWith(
        {
          ...payload,
          iss: `https://${host}`,
          aud: 'test-client-id',
        },
        mockPrivateKey,
        {
          expiresIn: '1h',
          algorithm: 'RS256',
          keyid: 'test-key-id',
        },
      );
      expect(result).toBe('test.jwt.token');
    });

    it('should handle errors when creating token', () => {
      mockJwtSign.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      expect(() => crypto.makeIdToken(payload, host)).toThrow(
        'Failed to create ID token: Test error',
      );
    });

    it('should handle missing key files', () => {
      fs.existsSync.mockReturnValue(false);
      const result = crypto.makeIdToken(payload, host);

      expect(result).toBe('test.jwt.token');
    });
  });
});
