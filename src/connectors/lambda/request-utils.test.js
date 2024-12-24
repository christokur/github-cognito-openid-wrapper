const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

// Declare intercept variables
let logger;
let parseBody;
let getParameters;

describe('parseBody', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    logger = require('../logger');
    parseBody = require('./request-utils').parseBody;
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./request-utils')];
    delete require.cache[require.resolve('../logger')];
  });

  describe('form-urlencoded data', () => {
    const formEvent = {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'code=test_code&state=test_state',
      isBase64Encoded: false,
    };

    it('should parse form data and set javascript content type', () => {
      const { body, contentType } = parseBody(formEvent);

      expect(body).toEqual({
        code: 'test_code',
        state: 'test_state',
      });
      expect(formEvent.headers['content-type']).toBe('application/javascript');
      expect(formEvent.body).toBe(body);
    });

    it('should be idempotent when called multiple times', () => {
      const first = parseBody(formEvent);
      const second = parseBody(formEvent);

      expect(first.body).toEqual(second.body);
      expect(first.contentType).toEqual(second.contentType);
      expect(typeof first.body).toBe('object');
    });

    it('should handle malformed form data', () => {
      const badFormEvent = {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'not=valid=form&data',
        isBase64Encoded: false,
      };

      const { body } = parseBody(badFormEvent);
      expect(typeof body).toBe('object');
      expect(body).toEqual({ not: 'valid=form', data: '' });
    });
  });

  describe('JSON data', () => {
    const jsonEvent = {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        code: 'test_code',
        state: 'test_state',
      }),
      isBase64Encoded: false,
    };

    it('should parse JSON and set javascript content type', () => {
      const { body, contentType } = parseBody(jsonEvent);

      expect(body).toEqual({
        code: 'test_code',
        state: 'test_state',
      });
      expect(jsonEvent.headers['content-type']).toBe('application/javascript');
      expect(jsonEvent.body).toBe(body);
    });

    it('should be idempotent when called multiple times', () => {
      const first = parseBody(jsonEvent);
      const second = parseBody(jsonEvent);

      expect(first.body).toEqual(second.body);
      expect(first.contentType).toEqual(second.contentType);
      expect(typeof first.body).toBe('object');
    });

    it('should handle invalid JSON', () => {
      const badJsonEvent = {
        headers: {
          'content-type': 'application/json',
        },
        body: '{ invalid json }',
        isBase64Encoded: false,
      };

      const { body } = parseBody(badJsonEvent);
      expect(body).toBe('{ invalid json }'); // Keep original on parse error
      expect(badJsonEvent.headers['content-type']).toBe('application/json');
    });
  });

  describe('base64 encoded data', () => {
    const base64Event = {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: Buffer.from('code=test_code&state=test_state').toString('base64'),
      isBase64Encoded: true,
    };

    it('should decode base64 and parse form data', () => {
      const { body } = parseBody(base64Event);

      expect(body).toEqual({
        code: 'test_code',
        state: 'test_state',
      });
      expect(base64Event.isBase64Encoded).toBe(false);
      expect(base64Event.headers['content-type']).toBe(
        'application/javascript',
      );
    });

    it('should be idempotent with base64 data', () => {
      const first = parseBody(base64Event);
      const second = parseBody(base64Event);

      expect(first.body).toEqual(second.body);
      expect(typeof first.body).toBe('object');
      expect(base64Event.isBase64Encoded).toBe(false);
    });

    it('should handle invalid base64', () => {
      const badBase64Event = {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'not-valid-base64',
        isBase64Encoded: true,
      };

      const { body } = parseBody(badBase64Event);
      expect(body).toBe('not-valid-base64'); // Keep original on decode error
      expect(badBase64Event.isBase64Encoded).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing body', () => {
      const emptyEvent = {
        headers: {},
      };

      const { body, contentType } = parseBody(emptyEvent);
      expect(body).toBeUndefined();
      expect(contentType).toBe('');
    });

    it('should handle missing content-type', () => {
      const noTypeEvent = {
        headers: {},
        body: 'some data',
      };

      const { body, contentType } = parseBody(noTypeEvent);
      expect(body).toBe('some data');
      expect(contentType).toBe('');
    });

    it('should handle missing headers', () => {
      const noHeadersEvent = {
        body: 'some data',
      };

      const { body, contentType } = parseBody(noHeadersEvent);
      expect(body).toBe('some data');
      expect(contentType).toBe('');
    });

    it('should handle null event', () => {
      const { body, contentType } = parseBody(null);
      expect(body).toBeUndefined();
      expect(contentType).toBe('');
    });
  });
});

describe('getParameters', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    logger = require('../logger');
    getParameters = require('./request-utils').getParameters;
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./request-utils')];
    delete require.cache[require.resolve('../logger')];
  });

  it('should extract query parameters for GET request', () => {
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        code: 'test_code',
        state: 'test_state',
      },
    };

    const params = getParameters(event);
    expect(params).toEqual({
      code: 'test_code',
      state: 'test_state',
    });
  });

  it('should extract body parameters for POST request', () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        code: 'test_code',
        state: 'test_state',
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const params = getParameters(event);
    expect(params).toEqual({
      code: 'test_code',
      state: 'test_state',
    });
  });

  it('should handle missing query parameters', () => {
    const event = {
      httpMethod: 'GET',
    };

    const params = getParameters(event);
    expect(params).toEqual({});
  });

  it('should handle missing body', () => {
    const event = {
      httpMethod: 'POST',
    };

    const params = getParameters(event);
    expect(params).toEqual({});
  });

  it('should extract access token from Authorization header', () => {
    const event = {
      httpMethod: 'GET',
      headers: {
        Authorization: 'Bearer test_token'
      }
    };

    const params = getParameters(event);
    expect(params).toEqual({
      access_token: 'test_token'
    });
  });
});
