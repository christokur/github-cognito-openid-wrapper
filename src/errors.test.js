// Mock the logger
jest.mock('./connectors/logger', () => ({
  error: jest.fn(),
}));
const logger = require('./connectors/logger');

const { OAuthError, errorTypes, formatOAuthError } = require('./errors');

describe('OAuthError', () => {
  it('should create error with custom message', () => {
    const customMessage = 'Custom error message';
    const error = new OAuthError(errorTypes.INVALID_REQUEST, customMessage);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(customMessage);
    expect(error.type).toBe(errorTypes.INVALID_REQUEST);
    expect(error.statusCode).toBe(400);
  });

  it('should create error with default message', () => {
    const error = new OAuthError(errorTypes.INVALID_CLIENT);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Client authentication failed');
    expect(error.type).toBe(errorTypes.INVALID_CLIENT);
    expect(error.statusCode).toBe(401);
  });

  it('should have correct status codes for all error types', () => {
    const expectedStatusCodes = {
      [errorTypes.INVALID_REQUEST]: 400,
      [errorTypes.INVALID_CLIENT]: 401,
      [errorTypes.INVALID_GRANT]: 400,
      [errorTypes.UNAUTHORIZED_CLIENT]: 403,
      [errorTypes.UNSUPPORTED_GRANT_TYPE]: 400,
      [errorTypes.INVALID_SCOPE]: 400,
      [errorTypes.ACCESS_DENIED]: 403,
      [errorTypes.SERVER_ERROR]: 500,
    };

    Object.keys(errorTypes).forEach((key) => {
      const error = new OAuthError(errorTypes[key]);
      expect(error.statusCode).toBe(expectedStatusCodes[errorTypes[key]]);
    });
  });
});

describe('formatOAuthError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format error with type and message', () => {
    const error = new OAuthError(errorTypes.INVALID_REQUEST, 'Test message');
    const formatted = formatOAuthError(error);

    expect(formatted).toEqual({
      error: errorTypes.INVALID_REQUEST,
      error_description: 'Test message',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'OAuth error',
        error: formatted,
      }),
    );
  });

  it('should use server_error as default type', () => {
    const error = new Error('Unknown error');
    const formatted = formatOAuthError(error);

    expect(formatted).toEqual({
      error: 'server_error',
      error_description: 'Unknown error',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'OAuth error',
        error: formatted,
      }),
    );
  });
});
