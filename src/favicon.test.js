const fs = require('fs');
const path = require('path');
const { mockAxios } = require('./sharedMocks');
const { mockValues } = require('./mocks');

let favicon;
let faviconVerifier;
let logger;

// Mock favicon binary content - First 4 bytes must be [0,0,1,0] for ICO format
const mockFaviconBase64 = 'AAAAAQAAAA=='; // [0,0,1,0,0,0,0,0]
const mockFaviconBinary = Buffer.from(mockFaviconBase64, 'base64');

describe('Favicon', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock fs module
    jest.spyOn(fs, 'readFileSync').mockReturnValue(mockFaviconBinary);

    // Mock webpack asset (for Lambda)
    jest.doMock('./assets/favicon.ico', () => `data:image/x-icon;base64,${mockFaviconBase64}`, { virtual: true });

    // Mock favicon verifier
    jest.doMock('./utils/favicon-verifier', () => ({
      verifyRequest: jest.fn(),
      verifyIco: jest.fn(),
      verifyResponse: jest.fn()
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
  });

  describe('handler', () => {
    const mockEvent = {
      httpMethod: 'GET',
      path: '/favicon.ico',
      headers: {}
    };
    const mockContext = { someContext: 'data' };

    it('should serve favicon from webpack asset', () => {
      const response = favicon.handler(mockEvent, mockContext);

      expect(faviconVerifier.verifyRequest).toHaveBeenCalledWith(mockEvent);
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': 'public, max-age=31536000'
        },
        body: mockFaviconBase64,
        isBase64Encoded: true
      });
    });

    it('should serve favicon from filesystem when webpack asset fails', () => {
      jest.resetModules();

      // Mock webpack require to fail
      jest.doMock('./assets/favicon.ico', () => { 
        throw new Error('webpack fail');
      }, { virtual: true });

      // Mock filesystem read
      jest.spyOn(fs, 'readFileSync').mockReturnValue(mockFaviconBinary);

      // Load favicon after webpack mock is set up
      favicon = require('./favicon');
      
      const response = favicon.handler(mockEvent, mockContext);

      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('favicon.ico'));
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': 'public, max-age=31536000'
        },
        body: mockFaviconBase64,
        isBase64Encoded: true
      });
    });

    it('should verify ICO format in debug mode', () => {
      process.env.LOG_LEVEL = 'debug';
      const response = favicon.handler(mockEvent, mockContext);

      expect(faviconVerifier.verifyIco).toHaveBeenCalledWith(expect.any(Buffer));
      expect(faviconVerifier.verifyResponse).toHaveBeenCalledWith(response);
      expect(response.body).toBe(mockFaviconBase64);

      delete process.env.LOG_LEVEL;
    });

    it('should handle invalid webpack asset format', () => {
      jest.resetModules();

      // Mock webpack asset with invalid format (missing base64 part)
      jest.doMock('./assets/favicon.ico', () => 'data:image/x-icon;base64', { virtual: true });

      // Mock filesystem read to fail as fallback
      const fsError = new Error('filesystem error');
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw fsError;
      });

      // Mock favicon verifier to pass validation
      jest.doMock('./utils/favicon-verifier', () => ({
        verifyRequest: jest.fn(),
        verifyIco: jest.fn(),
        verifyResponse: jest.fn()
      }));

      // Mock logger to capture error
      const mockError = jest.fn();
      jest.doMock('./connectors/logger', () => ({
        error: mockError,
        debug: jest.fn(),
        info: jest.fn()
      }));

      // Load favicon module after mocks
      delete require.cache[require.resolve('./favicon')];
      expect(() => {
        require('./favicon');
      }).toThrow('filesystem error');

      // Verify that the invalid asset format was logged before falling back to filesystem
      expect(mockError).toHaveBeenCalledWith('Invalid asset format', {
        assetStart: 'data:image/x-icon;base64'
      });
    });

    it('should handle filesystem read error', () => {
      jest.resetModules();

      // Mock webpack require to fail
      jest.doMock('./assets/favicon.ico', () => { 
        throw new Error('webpack fail');
      }, { virtual: true });

      // Mock favicon verifier to pass validation
      jest.doMock('./utils/favicon-verifier', () => ({
        verifyRequest: jest.fn(),
        verifyIco: jest.fn(),
        verifyResponse: jest.fn()
      }));

      // Mock filesystem error
      const fsError = new Error('filesystem error');
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw fsError;
      });

      delete require.cache[require.resolve('./favicon')];
      expect(() => {
        require('./favicon');
      }).toThrow('filesystem error');
    });

    it('should handle verifier errors', () => {
      const verifyError = new Error('verify error');
      jest.spyOn(faviconVerifier, 'verifyRequest').mockImplementation(() => {
        throw verifyError;
      });

      expect(() => favicon.handler(mockEvent, mockContext)).toThrow(verifyError);
    });
  });
});
