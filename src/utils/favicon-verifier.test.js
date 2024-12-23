const { mockAxios } = require('../sharedMocks');
const { mockValues } = require('../mocks');

let logger;
let faviconVerifier;

describe('Favicon Verifier', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    logger = require('../connectors/logger');
    faviconVerifier = require('./favicon-verifier');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./favicon-verifier')];
    delete require.cache[require.resolve('../connectors/logger')];
  });

  describe('verifyRequest', () => {
    it('should verify valid request', () => {
      const event = {
        httpMethod: 'GET',
        path: '/favicon.ico',
        headers: {}
      };

      expect(faviconVerifier.verifyRequest(event)).toBe(true);
    });

    it('should reject non-GET method', () => {
      const event = {
        httpMethod: 'POST',
        path: '/favicon.ico',
        headers: {}
      };

      expect(() => faviconVerifier.verifyRequest(event)).toThrow('Method not allowed');
    });

    it('should reject invalid path', () => {
      const event = {
        httpMethod: 'GET',
        path: '/wrong-path',
        headers: {}
      };

      expect(() => faviconVerifier.verifyRequest(event)).toThrow('Invalid path');
    });

    it('should reject missing headers', () => {
      const event = {
        httpMethod: 'GET',
        path: '/favicon.ico'
      };

      expect(() => faviconVerifier.verifyRequest(event)).toThrow('Missing headers');
    });
  });

  describe('verifyIco', () => {
    it('should verify valid ICO format', () => {
      const buffer = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]); // Valid ICO header
      expect(faviconVerifier.verifyIco(buffer)).toBe(true);
    });

    it('should reject invalid ICO format', () => {
      const buffer = Buffer.from([1, 1, 1, 1]); // Invalid ICO header
      expect(faviconVerifier.verifyIco(buffer)).toBe(false);
    });

    it('should log debug info for valid ICO', () => {
      const buffer = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]);
      jest.spyOn(logger, 'debug');

      faviconVerifier.verifyIco(buffer);

      expect(logger.debug).toHaveBeenCalledWith('ICO verification', {
        reservedBytes: [0, 0],
        typeBytes: [1, 0],
        bufferLength: 8,
        bufferStart: '0000010001001010'
      });
    });

    it('should log debug info for invalid ICO', () => {
      const buffer = Buffer.from([1, 1, 1, 1]);
      jest.spyOn(logger, 'debug');

      faviconVerifier.verifyIco(buffer);

      expect(logger.debug).toHaveBeenCalledWith('ICO header check failed', {
        byte0: 1,
        byte1: 1,
        byte2: 1,
        byte3: 1,
        expected: [0, 0, 1, 0]
      });
    });
  });

  describe('verifyResponse', () => {
    const validResponse = {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000'
      },
      body: Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]).toString('base64'),
      isBase64Encoded: true
    };

    it('should verify valid response', () => {
      expect(faviconVerifier.verifyResponse(validResponse)).toBe(true);
    });

    it('should reject invalid status code', () => {
      const response = {
        ...validResponse,
        statusCode: 404
      };

      expect(() => faviconVerifier.verifyResponse(response)).toThrow('Invalid status code');
    });

    it('should reject invalid Content-Type', () => {
      const response = {
        ...validResponse,
        headers: {
          ...validResponse.headers,
          'Content-Type': 'image/png'
        }
      };

      expect(() => faviconVerifier.verifyResponse(response)).toThrow('Invalid Content-Type header');
    });

    it('should accept Content-Type with parameters', () => {
      const response = {
        ...validResponse,
        headers: {
          ...validResponse.headers,
          'Content-Type': 'image/x-icon; charset=utf-8'
        }
      };

      expect(faviconVerifier.verifyResponse(response)).toBe(true);
    });

    it('should reject invalid Cache-Control', () => {
      const response = {
        ...validResponse,
        headers: {
          ...validResponse.headers,
          'Cache-Control': 'no-cache'
        }
      };

      expect(() => faviconVerifier.verifyResponse(response)).toThrow('Invalid Cache-Control header');
    });

    it('should reject missing body', () => {
      const response = {
        ...validResponse,
        body: null
      };

      expect(() => faviconVerifier.verifyResponse(response)).toThrow('Missing response body');
    });

    it('should handle non-base64 body', () => {
      const response = {
        ...validResponse,
        body: Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]),
        isBase64Encoded: false
      };

      expect(faviconVerifier.verifyResponse(response)).toBe(true);
    });

    it('should reject invalid ICO format in body', () => {
      const response = {
        ...validResponse,
        body: Buffer.from([1, 1, 1, 1]).toString('base64')
      };

      expect(() => faviconVerifier.verifyResponse(response)).toThrow('Invalid ICO format');
    });

    it('should reject invalid base64 body', () => {
      const response = {
        ...validResponse,
        body: 'not-base64!'
      };

      expect(() => faviconVerifier.verifyResponse(response)).toThrow('Invalid ICO format');
    });
  });
});
