const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

// Declare intercept variables
let logger;
let formatResponse;

describe('formatResponse', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    logger = require('../logger');
    formatResponse = require('./index').formatResponse;
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./index')];
    delete require.cache[require.resolve('../logger')];
  });

  it('should format JSON response with cache control', () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ data: 'test' })
    };
    const config = {
      cacheControl: 'no-store',
      cors: false
    };

    const formatted = formatResponse(response, config);
    expect(formatted).toEqual({
      statusCode: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: 'test' })
    });
  });

  it('should preserve existing headers', () => {
    const response = {
      statusCode: 200,
      headers: {
        'X-Custom': 'test'
      },
      body: JSON.stringify({ data: 'test' })
    };
    const config = {
      cacheControl: 'no-store',
      cors: false
    };

    const formatted = formatResponse(response, config);
    expect(formatted).toEqual({
      statusCode: 200,
      headers: {
        'X-Custom': 'test',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: 'test' })
    });
  });

  it('should handle non-JSON responses', () => {
    const response = {
      statusCode: 302,
      headers: {
        'Location': 'https://example.com'
      }
    };
    const config = {
      cacheControl: 'no-store',
      cors: false
    };

    const formatted = formatResponse(response, config);
    expect(formatted).toEqual({
      statusCode: 302,
      headers: {
        'Location': 'https://example.com',
        'Cache-Control': 'no-store'
      }
    });
  });

  it('should handle missing config', () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ data: 'test' })
    };

    const formatted = formatResponse(response, { cors: false });
    expect(formatted).toEqual({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: 'test' })
    });
  });
});
