const { withRetry, isRetryableError, exponentialBackoff } = require('./retry');
const logger = require('../connectors/logger');

jest.mock('../connectors/logger');

describe('Retry Utility Functions', () => {
  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error = { response: null };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 408 error', () => {
      const error = { response: { status: 408 } };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable error', () => {
      const error = { isRetryable: false };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 200 error', () => {
      const error = { response: { status: 200 } };
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('exponentialBackoff', () => {
    it('should calculate the correct delay', () => {
      expect(exponentialBackoff(0)).toBeGreaterThan(1000);
      expect(exponentialBackoff(1)).toBeGreaterThan(2000);
      expect(exponentialBackoff(2)).toBeGreaterThan(4000);
    });
  });

  describe('withRetry', () => {
    it('should return result on successful operation', () => {
      const operation = jest.fn(() => 'success');
      const result = withRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockImplementationOnce(() => { throw { response: { status: 500 } }; })
        .mockImplementationOnce(() => 'success');
      const result = withRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should log error after max retries', () => {
      const operation = jest.fn(() => { throw { response: { status: 500 } }; });
      expect(() => withRetry(operation, { maxRetries: 2 })).toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn(() => Promise.reject({ isRetryable: false }));
      await expect(withRetry(operation)).rejects.toThrow({ isRetryable: false });
      expect(logger.error).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
