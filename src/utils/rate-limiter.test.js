const rateLimiter = require('./rate-limiter');

describe('RateLimiter', () => {
  let originalDateNow;

  beforeEach(() => {
    originalDateNow = Date.now;
    // Mock Date.now() to return a fixed timestamp
    Date.now = jest.fn(() => 1640995200000); // 2022-01-01T00:00:00.000Z
  });

  afterEach(() => {
    Date.now = originalDateNow;
    jest.clearAllMocks();
  });

  describe('updateLimits', () => {
    test('should update rate limits from headers', () => {
      const headers = {
        'x-ratelimit-remaining': '4000',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '1641081600', // 2022-01-02T00:00:00.000Z
        'retry-after': '3600',
      };

      rateLimiter.updateLimits(headers);

      expect(rateLimiter.remaining).toBe(4000);
      expect(rateLimiter.total).toBe(5000);
      expect(rateLimiter.resetTime).toBe(1641081600000);
      expect(rateLimiter.retryAfter).toBe(3600000);
    });

    test('should handle missing headers', () => {
      const originalLimits = {
        remaining: rateLimiter.remaining,
        total: rateLimiter.total,
        resetTime: rateLimiter.resetTime,
        retryAfter: rateLimiter.retryAfter,
      };

      rateLimiter.updateLimits({});

      expect(rateLimiter.remaining).toBe(originalLimits.remaining);
      expect(rateLimiter.total).toBe(originalLimits.total);
      expect(rateLimiter.resetTime).toBe(originalLimits.resetTime);
      expect(rateLimiter.retryAfter).toBe(originalLimits.retryAfter);
    });
  });

  describe('checkLimit', () => {
    test('should not throw if remaining requests > 0', () => {
      rateLimiter.remaining = 100;
      expect(() => rateLimiter.checkLimit()).not.toThrow();
    });

    test('should throw rate limit error when no requests remaining', () => {
      rateLimiter.remaining = 0;
      rateLimiter.resetTime = Date.now() + 1000;
      rateLimiter.retryAfter = 0;

      expect(() => rateLimiter.checkLimit()).toThrow(
        'Rate limit exceeded',
      );
    });

    test('should throw rate limit error when retry-after is specified', () => {
      rateLimiter.remaining = 0;
      rateLimiter.resetTime = Date.now();
      rateLimiter.retryAfter = 1000;

      expect(() => rateLimiter.checkLimit()).toThrow(
        'Rate limit exceeded',
      );
    });
  });

  describe('isRateLimitError', () => {
    test('should identify 429 status as rate limit error', () => {
      const error = {
        response: {
          status: 429,
        },
      };
      expect(rateLimiter.isRateLimitError(error)).toBe(true);
    });

    test('should identify 403 with rate limit message as rate limit error', () => {
      const error = {
        response: {
          status: 403,
          data: {
            message: 'API rate limit exceeded',
          },
        },
      };
      expect(rateLimiter.isRateLimitError(error)).toBe(true);
    });

    test('should not identify other 403 errors as rate limit errors', () => {
      const error = {
        response: {
          status: 403,
          data: {
            message: 'Forbidden',
          },
        },
      };
      expect(rateLimiter.isRateLimitError(error)).toBe(false);
    });

    test('should handle errors without response object', () => {
      const error = {};
      expect(rateLimiter.isRateLimitError(error)).toBe(false);
    });

    test('should handle errors without data object', () => {
      const error = {
        response: {
          status: 403,
        },
      };
      expect(rateLimiter.isRateLimitError(error)).toBe(false);
    });
  });
});
