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
    it('should verify valid request', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/favicon.ico',
        headers: {},
      };

      await expect(faviconVerifier.verifyRequest(event)).resolves.toBe(true);
    });

    it('should reject non-GET method', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/favicon.ico',
        headers: {},
      };

      await expect(faviconVerifier.verifyRequest(event)).rejects.toThrow(
        'Method not allowed',
      );
    });

    it('should reject invalid path', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/wrong-path',
        headers: {},
      };

      await expect(faviconVerifier.verifyRequest(event)).rejects.toThrow(
        'Invalid path',
      );
    });

    it('should reject missing headers', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/favicon.ico',
      };

      await expect(faviconVerifier.verifyRequest(event)).rejects.toThrow(
        'Missing headers',
      );
    });
  });

  describe('verifyIco', () => {
    it('should verify valid ICO format', async () => {
      const buffer = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]); // Valid ICO header
      await expect(faviconVerifier.verifyIco(buffer)).resolves.toBe(true);
    });

    it('should reject invalid ICO format', async () => {
      const buffer = Buffer.from([1, 1, 1, 1]); // Invalid ICO header
      await expect(faviconVerifier.verifyIco(buffer)).resolves.toBe(false);
    });

    it('should log debug info for valid ICO', async () => {
      const buffer = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]);
      jest.spyOn(logger, 'debug');

      await faviconVerifier.verifyIco(buffer);

      expect(logger.debug).toHaveBeenCalledWith('ICO verification', {
        reservedBytes: [0, 0],
        typeBytes: [1, 0],
        bufferLength: 8,
        bufferStart: '0000010001001010',
      });
    });

    it('should log debug info for invalid ICO', async () => {
      const buffer = Buffer.from([1, 1, 1, 1]);
      jest.spyOn(logger, 'debug');

      await faviconVerifier.verifyIco(buffer);

      expect(logger.debug).toHaveBeenCalledWith('ICO header check failed', {
        byte0: 1,
        byte1: 1,
        byte2: 1,
        byte3: 1,
        expected: [0, 0, 1, 0],
      });
    });
  });

  describe('verifyResponse', () => {
    const validResponse = {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000',
      },
      body: Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]).toString('base64'),
      isBase64Encoded: true,
    };

    it('should verify valid response', async () => {
      await expect(faviconVerifier.verifyResponse(validResponse)).resolves.toBe(true);
    });

    it('should reject invalid status code', async () => {
      const response = {
        ...validResponse,
        statusCode: 404,
      };

      await expect(faviconVerifier.verifyResponse(response)).rejects.toThrow(
        'Invalid status code',
      );
    });

    it('should reject invalid Content-Type', async () => {
      const response = {
        ...validResponse,
        headers: {
          ...validResponse.headers,
          'Content-Type': 'image/png',
        },
      };

      await expect(faviconVerifier.verifyResponse(response)).rejects.toThrow(
        'Invalid Content-Type header',
      );
    });

    it('should accept Content-Type with parameters', async () => {
      const response = {
        ...validResponse,
        headers: {
          ...validResponse.headers,
          'Content-Type': 'image/x-icon; charset=utf-8',
        },
      };

      await expect(faviconVerifier.verifyResponse(response)).resolves.toBe(true);
    });

    it('should reject invalid Cache-Control', async () => {
      const response = {
        ...validResponse,
        headers: {
          ...validResponse.headers,
          'Cache-Control': 'no-cache',
        },
      };

      await expect(faviconVerifier.verifyResponse(response)).rejects.toThrow(
        'Invalid Cache-Control header',
      );
    });

    it('should reject missing body', async () => {
      const response = {
        ...validResponse,
        body: null,
      };

      await expect(faviconVerifier.verifyResponse(response)).rejects.toThrow(
        'Missing response body',
      );
    });

    it('should handle non-base64 body', async () => {
      const response = {
        ...validResponse,
        body: Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]),
        isBase64Encoded: false,
      };

      await expect(faviconVerifier.verifyResponse(response)).resolves.toBe(true);
    });

    it('should reject invalid ICO format in body', async () => {
      const response = {
        ...validResponse,
        body: Buffer.from([1, 1, 1, 1]).toString('base64'),
      };

      await expect(faviconVerifier.verifyResponse(response)).rejects.toThrow(
        'Invalid ICO format',
      );
    });

    it('should reject invalid base64 body', async () => {
      const response = {
        ...validResponse,
        body: 'not-base64!',
      };

      await expect(faviconVerifier.verifyResponse(response)).rejects.toThrow(
        'Invalid ICO format',
      );
    });
  });
});
