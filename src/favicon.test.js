const fs = require('fs');
const path = require('path');
const { mockAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

let favicon;
let faviconVerifier;
let logger;

// Simple 1x1 ICO format mock
const mockFaviconBase64 = 'AAAAAQAAAA==';
const mockFaviconBinary = Buffer.from(mockFaviconBase64, 'base64');

describe('Favicon', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock fs.promises for filesystem fallback
    jest.spyOn(fs.promises, 'readFile')
      .mockResolvedValue(mockFaviconBinary);

    // Mock webpack asset with data URL format
    jest.doMock('./assets/favicon.ico', () => `data:image/x-icon;base64,${mockFaviconBase64}`, { virtual: true });

    // Mock favicon verifier
    jest.doMock('./utils/favicon-verifier', () => ({
      verifyRequest: jest.fn().mockResolvedValue(),
      verifyIco: jest.fn().mockResolvedValue(),
      verifyResponse: jest.fn().mockResolvedValue(),
    }));

    // Mock logger
    jest.doMock('./connectors/logger', () => ({
      error: jest.fn(),
      debug: jest.fn(),
    }));

    // Load modules after mocks
    faviconVerifier = require('./utils/favicon-verifier');
    logger = require('./connectors/logger');
    favicon = require('./favicon');
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./favicon')];
    delete require.cache[require.resolve('./assets/favicon.ico')];
    delete require.cache[require.resolve('./utils/favicon-verifier')];
    delete require.cache[require.resolve('./connectors/logger')];
    delete process.env.LOG_LEVEL;
  });

  describe('handler', () => {
    const mockEvent = {
      httpMethod: 'GET',
      path: '/favicon.ico',
      headers: {},
    };
    const mockContext = { someContext: 'data' };

    it('should serve favicon from webpack asset', async () => {
      const response = await favicon.handler(mockEvent, mockContext);

      expect(faviconVerifier.verifyRequest).toHaveBeenCalledWith(mockEvent);
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': 'public, max-age=31536000',
        },
        body: mockFaviconBase64,
        isBase64Encoded: true,
      });
    });

    it('should serve favicon from filesystem when webpack asset fails', async () => {
      jest.resetModules();

      // Mock webpack require to fail
      jest.doMock('./assets/favicon.ico', () => {
        throw new Error('webpack fail');
      }, { virtual: true });

      // Mock filesystem read
      jest.spyOn(fs.promises, 'readFile')
        .mockResolvedValue(mockFaviconBinary);

      // Mock favicon verifier
      jest.doMock('./utils/favicon-verifier', () => ({
        verifyRequest: jest.fn().mockResolvedValue(),
        verifyIco: jest.fn().mockResolvedValue(),
        verifyResponse: jest.fn().mockResolvedValue(),
      }));

      // Load favicon after mocks are set up
      favicon = require('./favicon');

      const response = await favicon.handler(mockEvent, mockContext);

      // Verify filesystem fallback was used
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('favicon.ico')
      );

      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': 'public, max-age=31536000',
        },
        body: mockFaviconBase64,
        isBase64Encoded: true,
      });
    });

    it('should verify ICO format in debug mode', async () => {
      process.env.LOG_LEVEL = 'debug';

      const response = await favicon.handler(mockEvent, mockContext);

      expect(faviconVerifier.verifyIco).toHaveBeenCalledWith(
        expect.any(Buffer)
      );
      expect(faviconVerifier.verifyResponse).toHaveBeenCalledWith(response);
      expect(response.body).toBe(mockFaviconBase64);
    });

    it('should handle invalid webpack asset format', async () => {
      jest.resetModules();

      // Mock webpack asset with invalid format
      jest.doMock('./assets/favicon.ico', () => 'invalid-format', { virtual: true });

      // Mock logger
      const mockError = jest.fn();
      jest.doMock('./connectors/logger', () => ({
        error: mockError,
        debug: jest.fn(),
      }));

      // Mock filesystem read to fail
      jest.spyOn(fs.promises, 'readFile')
        .mockRejectedValue(new Error('filesystem error'));

      // Mock favicon verifier
      jest.doMock('./utils/favicon-verifier', () => ({
        verifyRequest: jest.fn().mockResolvedValue(),
        verifyIco: jest.fn().mockResolvedValue(),
        verifyResponse: jest.fn().mockResolvedValue(),
      }));

      // Load favicon after mocks are set up
      favicon = require('./favicon');

      const response = await favicon.handler(mockEvent, mockContext);
      expect(response.statusCode).toBe(500);
      expect(mockError).toHaveBeenCalledWith('Invalid asset format', expect.any(Object));
    });

    it('should handle filesystem read error', async () => {
      jest.resetModules();

      // Mock webpack require to fail
      jest.doMock('./assets/favicon.ico', () => {
        throw new Error('webpack fail');
      }, { virtual: true });

      // Mock filesystem read to fail
      jest.spyOn(fs.promises, 'readFile')
        .mockRejectedValue(new Error('filesystem error'));

      // Mock favicon verifier
      jest.doMock('./utils/favicon-verifier', () => ({
        verifyRequest: jest.fn().mockResolvedValue(),
        verifyIco: jest.fn().mockResolvedValue(),
        verifyResponse: jest.fn().mockResolvedValue(),
      }));

      // Load favicon after mocks are set up
      favicon = require('./favicon');

      const response = await favicon.handler(mockEvent, mockContext);
      expect(response.statusCode).toBe(500);
      expect(response.body).toBe('Internal Server Error');
    });

    it('should handle verifier errors', async () => {
      jest.spyOn(faviconVerifier, 'verifyRequest')
        .mockRejectedValue(new Error('verify error'));

      const response = await favicon.handler(mockEvent, mockContext);
      expect(response.statusCode).toBe(500);
      expect(response.body).toBe('Internal Server Error');
    });
  });
});
