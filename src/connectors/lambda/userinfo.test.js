const { mockValues } = require('../../mocks');

let controllers;
let userinfo;
let mockControllerInstance;

describe('Lambda Userinfo Handler', () => {
  let mockEvent;
  let mockContext;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock controllers module
    jest.doMock('../controllers', () => jest.fn(() => mockControllerInstance));

    // Create mock controller instance
    mockControllerInstance = {
      userinfo: jest.fn(),
    };

    // Require modules after mocking
    controllers = require('../controllers');
    userinfo = require('./userinfo');

    // Setup default mock event and context
    mockEvent = {
      headers: {
        Authorization: 'Bearer test-token',
      },
      queryStringParameters: {},
    };
    mockContext = {};
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../controllers')];
    delete require.cache[require.resolve('./userinfo')];
    jest.dontMock('../controllers');
  });

  it('should extract token and call userinfo controller', async () => {
    // Setup mock response
    const mockResponse = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sub: 'test-user' }),
    };
    mockControllerInstance.userinfo.mockResolvedValue(mockResponse);

    // Call handler
    const response = await userinfo.handler(mockEvent, mockContext);

    // Verify controller was called with correct token
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith('test-token');
    expect(response).toEqual(mockResponse);
  });

  it('should handle missing Authorization header', async () => {
    // Remove Authorization header
    delete mockEvent.headers.Authorization;

    // Setup mock error response
    const mockResponse = {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing access token',
      }),
    };
    mockControllerInstance.userinfo.mockResolvedValue(mockResponse);

    // Call handler
    const response = await userinfo.handler(mockEvent, mockContext);

    // Verify controller was called with empty token
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith('');
    expect(response).toEqual(mockResponse);
  });

  it('should handle validation error', async () => {
    // Setup mock validation error
    const mockResponse = {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'invalid_request',
        error_description: 'Invalid access token',
      }),
    };
    mockControllerInstance.userinfo.mockResolvedValue(mockResponse);

    // Call handler with invalid token
    mockEvent.headers.Authorization = 'Bearer invalid-token';
    const response = await userinfo.handler(mockEvent, mockContext);

    // Verify controller was called with invalid token
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith('invalid-token');
    expect(response).toEqual(mockResponse);
  });

  it('should handle service error', async () => {
    // Setup mock service error
    const mockResponse = {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error',
      }),
    };
    mockControllerInstance.userinfo.mockResolvedValue(mockResponse);

    // Call handler
    const response = await userinfo.handler(mockEvent, mockContext);

    // Verify controller was called and error was returned
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith('test-token');
    expect(response).toEqual(mockResponse);
  });
});
