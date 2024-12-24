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
    formatResponse = require('./response-utils').formatResponse;
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./response-utils')];
    delete require.cache[require.resolve('../logger')];
  });

  it('should format JSON response with cache control', () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ data: 'test' }),
    };
    const config = {
      cacheControl: 'no-store',
      cors: false,
    };

    const formatted = formatResponse(response, config);
    expect(formatted).toEqual({
      statusCode: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: 'test' }),
    });
  });

  it('should preserve existing headers', () => {
    const response = {
      statusCode: 200,
      headers: {
        'X-Custom': 'test',
      },
      body: JSON.stringify({ data: 'test' }),
    };
    const config = {
      cacheControl: 'no-store',
      cors: false,
    };

    const formatted = formatResponse(response, config);
    expect(formatted).toEqual({
      statusCode: 200,
      headers: {
        'X-Custom': 'test',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: 'test' }),
    });
  });

  it('should handle non-JSON responses', () => {
    const response = {
      statusCode: 302,
      headers: {
        Location: 'https://example.com',
      },
    };
    const config = {
      cacheControl: 'no-store',
      cors: false,
    };

    const formatted = formatResponse(response, config);
    expect(formatted).toEqual({
      statusCode: 302,
      headers: {
        Location: 'https://example.com',
        'Cache-Control': 'no-store',
      },
    });
  });

  it('should handle missing config', () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ data: 'test' }),
    };

    const formatted = formatResponse(response, { cors: false });
    expect(formatted).toEqual({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: 'test' }),
    });
  });

  it('should add CORS headers when enabled', () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ data: 'test' }),
    };
    const config = {
      cors: true,
      allowedMethods: ['GET', 'POST'],
    };

    const formatted = formatResponse(response, config);
    expect(formatted.headers).toEqual({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
    });
  });

  it('should handle CORS with default allowed methods', () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ data: 'test' }),
    };
    const config = {
      cors: true,
    };

    const formatted = formatResponse(response, config);
    expect(formatted.headers['Access-Control-Allow-Methods']).toBe('GET');
  });

  it('should handle base64 encoded responses', () => {
    const response = {
      statusCode: 200,
      body: 'base64EncodedData',
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'image/x-icon',
      },
    };
    const config = {
      cacheControl: 'public, max-age=3600',
    };

    const formatted = formatResponse(response, config);
    expect(formatted).toEqual({
      statusCode: 200,
      body: 'base64EncodedData',
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  });

  it('should handle base64 encoded responses with missing body', () => {
    const response = {
      statusCode: 200,
      isBase64Encoded: true,
    };

    const formatted = formatResponse(response);
    expect(formatted).toEqual({
      statusCode: 200,
      isBase64Encoded: true,
      headers: {},
    });
  });
});
