const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

// Declare intercept variables
let logger;
let handler;

describe('Lambda Handler', () => {
  let mockEvent;
  let mockContext;
  let mockCallback;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Load fresh copies of intercepted modules
    logger = require('../logger');
    handler = require('./index').handler;

    // Setup default mock event and context
    mockEvent = {
      path: '/authorize',
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
    };
    mockContext = {
      awsRequestId: 'test-request-id',
    };
    mockCallback = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('../logger')];
    delete require.cache[require.resolve('./index')];
  });

  it('should handle successful request with callback', () => {
    const response = handler(mockEvent, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
      statusCode: expect.any(Number),
      headers: expect.any(Object),
    }));
  });

  it('should handle successful request without callback', () => {
    const response = handler(mockEvent, mockContext);

    expect(response).toEqual(expect.objectContaining({
      statusCode: expect.any(Number),
      headers: expect.any(Object),
    }));
  });

  it('should handle missing path', () => {
    delete mockEvent.path;
    const response = handler(mockEvent, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
      statusCode: 404,
      body: expect.stringContaining('not_found'),
    }));
  });

  it('should handle unknown path', () => {
    mockEvent.path = '/unknown';
    const response = handler(mockEvent, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
      statusCode: 404,
      body: expect.stringContaining('not_found'),
    }));
  });

  it('should handle error with callback', () => {
    delete mockEvent.path;
    const response = handler(mockEvent, mockContext, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
      statusCode: 404,
      body: expect.stringContaining('not_found'),
    }));
  });
});
