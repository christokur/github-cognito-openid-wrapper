const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

let controllers;
let jwks;

describe('Lambda JWKS Handler', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.mock('../controllers', () => jest.fn(() => ({ jwks: jest.fn() })));
    controllers = require('../controllers');
    jwks = require('./jwks');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../controllers')];
    delete require.cache[require.resolve('./jwks')];
  });

  test('should return JWKS', async () => {
    const mockResponse = {
      keys: [
        {
          kty: 'RSA',
          kid: 'test-key-id',
          use: 'sig',
          alg: 'RS256',
          n: 'test-modulus',
          e: 'AQAB',
        },
      ],
    };

    const mockJwks = jest.fn().mockResolvedValue(mockResponse);
    controllers.mockReturnValue({ jwks: mockJwks });

    const result = await jwks.handler();

    expect(mockJwks).toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });
});
