const { mockAxios } = require('../../src/sharedMocks');
const { mockValues } = require('../../src/mocks');

jest.mock('../../src/connectors/logger');
jest.mock('./backoff', () => ({
  exponentialBackoff: jest.fn(),
}));

let backoff;
let logger;
let retry;

describe('Retry Utility Functions', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    backoff = require('./backoff');
    logger = require('../../src/connectors/logger');
    retry = require('./retry');

    backoff.exponentialBackoff = jest.fn().mockReturnValue(0);
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./backoff')];
    delete require.cache[require.resolve('../../src/connectors/logger')];
    delete require.cache[require.resolve('./retry')];
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error = { response: null };
      expect(retry.isRetryableError(error)).toBe(true);
    });

    it('should return true for 408 error', () => {
      const error = { response: { status: 408 } };
      expect(retry.isRetryableError(error)).toBe(true);
    });

    it('should return false for 400 error', () => {
      const error = { response: { status: 400 } };
      expect(retry.isRetryableError(error)).toBe(false);
    });

    it('should return false for 200 error', () => {
      const error = { response: { status: 200 } };
      expect(retry.isRetryableError(error)).toBe(false);
    });
  });

  describe('exponentialBackoff', () => {
    it('should calculate the correct delay', () => {
      const originalExponentialBackoff =
        jest.requireActual('./backoff').exponentialBackoff;
      expect(originalExponentialBackoff(0)).toBeGreaterThan(1000);
      expect(originalExponentialBackoff(1)).toBeGreaterThan(2000);
      expect(originalExponentialBackoff(2)).toBeGreaterThan(4000);
    });
  });

  describe('withRetry', () => {
    it('should return result on successful operation', async () => {
      const operation = jest.fn(() => 'success');
      const result = await retry.withRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest
        .fn()
        .mockImplementationOnce(() => {
          throw { response: { status: 500 } };
        })
        .mockImplementationOnce(() => 'success');
      const result = await retry.withRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries for retryable errors', async () => {
      const error = { response: { status: 500 } };
      const operation = jest.fn(() => {
        throw error;
      });

      await expect(
        retry.withRetry(operation, {
          maxRetries: 1,
          baseDelay: 0,
          maxDelay: 0,
        }),
      ).rejects.toMatchObject({
        response: { status: 500 },
      });
      expect(operation).toHaveBeenCalledTimes(2); // Initial attempt + 1 retry
      expect(backoff.exponentialBackoff).toHaveBeenCalledTimes(1);
    });

    it('should not retry on non-retryable status codes', async () => {
      const error = { response: { status: 400 } };
      const operation = jest.fn(() => {
        throw error;
      });

      await expect(retry.withRetry(operation)).rejects.toMatchObject({
        response: { status: 400 },
      });
      expect(operation).toHaveBeenCalledTimes(1); // Only initial attempt, no retries
      expect(backoff.exponentialBackoff).not.toHaveBeenCalled();
    });
  });
});
