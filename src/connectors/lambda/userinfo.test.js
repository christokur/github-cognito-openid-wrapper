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
      userinfo: jest.fn()
    };

    // Require modules after mocking
    controllers = require('../controllers');
    userinfo = require('./userinfo');

    // Setup default mock event and context
    mockEvent = {
      headers: {
        Authorization: 'Bearer test-token'
      },
      queryStringParameters: {}
    };
    mockContext = {};
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../controllers')];
    delete require.cache[require.resolve('./userinfo')];
    jest.dontMock('../controllers');
  });

  it('should extract token and call userinfo controller', () => {
    // Setup mock response
    const mockResponse = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sub: 'test-user' })
    };
    mockControllerInstance.userinfo.mockReturnValue(mockResponse);

    // Call handler
    const response = userinfo.handler(mockEvent, mockContext);

    // Verify controller was called with correct token
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith('test-token');
    expect(response).toEqual(mockResponse);
  });

  it('should handle missing Authorization header', () => {
    // Remove Authorization header
    delete mockEvent.headers.Authorization;

    // Setup mock error response
    const mockResponse = {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing access token'
      })
    };
    mockControllerInstance.userinfo.mockReturnValue(mockResponse);

    // Call handler
    const response = userinfo.handler(mockEvent, mockContext);

    // Verify controller was called with undefined token
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith(undefined);
    expect(response).toEqual(mockResponse);
  });

  it('should handle validation error', () => {
    // Setup mock validation error
    const mockResponse = {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'invalid_request',
        error_description: 'Invalid access token'
      })
    };
    mockControllerInstance.userinfo.mockReturnValue(mockResponse);

    // Call handler
    const response = userinfo.handler(mockEvent, mockContext);

    // Verify controller was called and error was returned
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith('test-token');
    expect(response).toEqual(mockResponse);
  });

  it('should handle service error', () => {
    // Setup mock service error
    const mockResponse = {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    };
    mockControllerInstance.userinfo.mockReturnValue(mockResponse);

    // Call handler
    const response = userinfo.handler(mockEvent, mockContext);

    // Verify controller was called and error was returned
    expect(mockControllerInstance.userinfo).toHaveBeenCalledWith('test-token');
    expect(response).toEqual(mockResponse);
  });
});
