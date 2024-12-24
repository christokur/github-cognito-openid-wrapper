const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

let controllers;
let authorize;
let mockAuthorize;

describe('Lambda Authorize Handler', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockAuthorize = jest.fn();
    jest.mock('../controllers', () =>
      jest.fn(() => ({ authorize: mockAuthorize })),
    );
    controllers = require('../controllers');
    authorize = require('./authorize');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../controllers')];
    delete require.cache[require.resolve('./authorize')];
  });

  test('should handle authorize request with all parameters', async () => {
    const event = {
      queryStringParameters: {
        client_id: 'test-client',
        scope: 'user:email',
        state: 'test-state',
        response_type: 'code',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      },
    };

    const mockResponse = {
      statusCode: 302,
      headers: { Location: 'https://github.com/login/oauth/authorize' },
    };

    mockAuthorize.mockResolvedValue(mockResponse);

    const result = await authorize.handler(event);

    expect(mockAuthorize).toHaveBeenCalledWith(
      'test-client',
      'user:email',
      'test-state',
      'code',
      'test-challenge',
      'S256',
    );
    expect(result).toEqual(mockResponse);
  });

  test('should handle authorize request with no parameters', async () => {
    const event = {};

    const mockResponse = {
      statusCode: 302,
      headers: { Location: 'https://github.com/login/oauth/authorize' },
    };

    mockAuthorize.mockResolvedValue(mockResponse);

    const result = await authorize.handler(event);

    expect(mockAuthorize).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual(mockResponse);
  });

  test('should handle authorize request with partial parameters', async () => {
    const event = {
      queryStringParameters: {
        client_id: 'test-client',
        scope: 'user:email',
      },
    };

    const mockResponse = {
      statusCode: 302,
      headers: { Location: 'https://github.com/login/oauth/authorize' },
    };

    mockAuthorize.mockResolvedValue(mockResponse);

    const result = await authorize.handler(event);

    expect(mockAuthorize).toHaveBeenCalledWith(
      'test-client',
      'user:email',
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual(mockResponse);
  });
});
