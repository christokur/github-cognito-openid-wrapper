/* eslint-disable */
/* eslint-disable no-undef */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */

require('./mocks');

const Configuration = require('./config');
const ConfigurationService = require('./services/configuration');
const { mockAxios, mockGetAxios } = require('./sharedMocks');

describe('openid domain layer - Configuration', () => {
  let openid;
  let githubMockInstance;
  let cryptoMockInstance;

  beforeEach(async () => {
    openid = require('./openid');
    githubMockInstance = require('./github');
    cryptoMockInstance = require('./crypto');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('jwks', () => {
    test('Returns the right structure', () => {
      expect(openid.getJwks()).toEqual({
        keys: [
          {
            alg: 'RS256',
            kid: 'jwtRS256',
            kty: 'RSA',
            e: 'AQAB',
            n: 'mocked_n_value',
          },
        ],
      });
    });
  });

  describe('openid-configuration', () => {
    describe('with a supplied hostname', () => {
      test('returns the correct response', () => {
        const host = 'not-a-real-host.com';
        const config = openid.getConfigFor(host);

        expect(config).toEqual({
          issuer: `https://${host}`,
          authorization_endpoint: `https://${host}/authorize`,
          token_endpoint: `https://${host}/token`,
          token_endpoint_auth_methods_supported: [
            'client_secret_basic',
            'private_key_jwt',
          ],
          token_endpoint_auth_signing_alg_values_supported: ['RS256'],
          userinfo_endpoint: `https://${host}/userinfo`,
          jwks_uri: `https://${host}/.well-known/jwks.json`,
          scopes_supported: ['openid', 'read:user', 'user:email'],
          response_types_supported: ['code', 'code id_token'],
          response_modes_supported: ['query', 'fragment'],
          grant_types_supported: ['authorization_code'],
          subject_types_supported: ['public'],
          userinfo_signing_alg_values_supported: ['none'],
          id_token_signing_alg_values_supported: ['RS256'],
          request_object_signing_alg_values_supported: ['none'],
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
          code_challenge_methods_supported: ['plain', 'S256']
        });
      });

      test('normalizes host without protocol', () => {
        const host = 'example.com';
        const config = openid.getConfigFor(host);
        expect(config.issuer).toBe('https://example.com');
      });

      test('preserves https protocol', () => {
        const host = 'https://secure.example.com';
        const config = openid.getConfigFor(host);
        expect(config.issuer).toBe('https://secure.example.com');
      });

      test('fails without host', () => {
        expect(() => openid.getConfigFor()).toThrow('Host is required');
      });
    });
  });
});
