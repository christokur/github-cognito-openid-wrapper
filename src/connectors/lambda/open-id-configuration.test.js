const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

jest.mock('../controllers', () => {
    const mockOpenIdConfiguration = jest.fn();
    return jest.fn(() => ({
        openIdConfiguration: mockOpenIdConfiguration
    }));
});

let logger;
let controllers;
let openIdConfiguration;

describe('OpenID Configuration Lambda Handler', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        logger = require("../logger");
        controllers = require('../controllers');
        openIdConfiguration = require('./open-id-configuration');
    });

    afterEach(() => {
        jest.resetModules();
        delete require.cache[require.resolve('./open-id-configuration')];
        delete require.cache[require.resolve('../controllers')];
        delete require.cache[require.resolve('../../connectors/logger')];
    });

    describe('handler', () => {
        it('should return OpenID configuration with host from headers', () => {
            const host = 'example.com';
            const expectedConfig = {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    issuer: `https://${host}`,
                    authorization_endpoint: `https://${host}/authorize`,
                    token_endpoint: `https://${host}/token`,
                    userinfo_endpoint: `https://${host}/userinfo`,
                    jwks_uri: `https://${host}/.well-known/jwks.json`,
                    response_types_supported: ['code'],
                    subject_types_supported: ['public'],
                    id_token_signing_alg_values_supported: ['RS256'],
                    scopes_supported: ['openid', 'profile', 'email'],
                    token_endpoint_auth_methods_supported: ['client_secret_basic'],
                    claims_supported: ['sub', 'name', 'email', 'username']
                })
            };

            controllers().openIdConfiguration.mockReturnValue(expectedConfig);

            const event = {
                headers: {
                    Host: host
                }
            };

            const result = openIdConfiguration.handler(event);
            expect(result).toEqual(expectedConfig);
            expect(controllers().openIdConfiguration).toHaveBeenCalledWith(`https://${host}`);
        });

        it('should handle missing Host header', () => {
            const event = {
                headers: {}
            };

            const result = openIdConfiguration.handler(event);

            expect(result).toEqual({
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'invalid_request',
                    error_description: 'Host header is required'
                })
            });
        });

        it('should handle no headers', () => {
            const event = {};

            const result = openIdConfiguration.handler(event);

            expect(result).toEqual({
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'invalid_request',
                    error_description: 'Host header is required'
                })
            });
        });

        it('should handle server errors', () => {
            const host = 'example.com';
            const error = new Error('Test error');

            controllers().openIdConfiguration.mockImplementation(() => {
                throw error;
            });

            const event = {
                headers: {
                    Host: host
                }
            };

            const result = openIdConfiguration.handler(event);

            expect(result).toEqual({
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'server_error',
                    error_description: 'Test error'
                })
            });
        });

        it('should not add https:// if host already has protocol', () => {
            const host = 'http://example.com';
            const expectedConfig = {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: 'data' })
            };

            controllers().openIdConfiguration.mockReturnValue(expectedConfig);

            const event = {
                headers: {
                    Host: host
                }
            };

            const result = openIdConfiguration.handler(event);
            expect(result).toEqual(expectedConfig);
            expect(controllers().openIdConfiguration).toHaveBeenCalledWith(host);
        });
    });
});
