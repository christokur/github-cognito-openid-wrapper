const logger = require('../connectors/logger');

class RateLimiter {
  constructor() {
    this.resetTime = Date.now();
    this.remaining = 5000; // GitHub's default rate limit
    this.total = 5000;
    this.retryAfter = 0;
  }

  updateLimits(headers) {
    if (headers['x-ratelimit-remaining']) {
      this.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }
    if (headers['x-ratelimit-limit']) {
      this.total = parseInt(headers['x-ratelimit-limit'], 10);
    }
    if (headers['x-ratelimit-reset']) {
      this.resetTime = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
    }
    if (headers['retry-after']) {
      this.retryAfter = parseInt(headers['retry-after'], 10) * 1000;
    }

    logger.debug({
      message: 'Rate limit status',
      remaining: this.remaining,
      total: this.total,
      resetTime: new Date(this.resetTime).toISOString(),
      retryAfter: this.retryAfter
    });
  }

  checkLimit() {
    if (this.remaining <= 0) {
      const now = Date.now();
      const waitTime = Math.max(this.resetTime - now, this.retryAfter);
      
      if (waitTime > 0) {
        logger.warn({
          message: 'Rate limit exceeded',
          waitTime,
          resetTime: new Date(this.resetTime).toISOString()
        });
        
        throw new Error('GitHub API responded with a failure: 429 (API rate limit exceeded)');
      }
    }
  }

  isRateLimitError(error) {
    return !!(error?.response && 
           (error.response.status === 429 || 
            (error.response.status === 403 && 
             error.response.data?.message?.includes('rate limit'))));
  }
}

module.exports = new RateLimiter();
