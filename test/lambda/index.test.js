const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// Mock dependencies
const loggerMock = {
  info: sinon.spy(),
  error: sinon.spy(),
  warn: sinon.spy()
};

const validatorMock = {
  validate: sinon.stub()
};

const rateLimiterMock = {
  checkLimit: sinon.stub().resolves(),
  isRateLimitError: sinon.stub().returns(false)
};

// Mock handlers
const authorizeHandlerMock = {
  handler: sinon.stub()
};

const tokenHandlerMock = {
  handler: sinon.stub()
};

const userinfoHandlerMock = {
  handler: sinon.stub()
};

const jwksHandlerMock = {
  handler: sinon.stub()
};

const openIdConfigurationHandlerMock = {
  handler: sinon.stub()
};

// Load index.js with mocked dependencies
const { handler } = proxyquire('../../src/connectors/lambda/index', {
  '../logger': loggerMock,
  '../../utils/validator': validatorMock,
  '../../utils/rate-limiter': rateLimiterMock,
  './authorize': authorizeHandlerMock,
  './token': tokenHandlerMock,
  './userinfo': userinfoHandlerMock,
  './jwks': jwksHandlerMock,
  './open-id-configuration': openIdConfigurationHandlerMock,
  './version': { VERSION: '1.0.0' }
});

describe('Lambda Handler', () => {
  beforeEach(() => {
    // Reset all mocks
    sinon.resetHistory();
    process.env.VERSION_CONSUMER = '1.0.0';
    process.env.VERSION_COMPONENT = '1.0.0';
  });

  describe('Authorization Endpoint', () => {
    it('should process a valid authorization request', async () => {
      // Setup test data
      const event = {
        path: '/authorize',
        httpMethod: 'GET',
        queryStringParameters: {
          client_id: 'test-client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          scope: 'openid profile',
          state: 'test-state',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256'
        },
        headers: {}
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      // Mock successful validation
      validatorMock.validate.returns(true);

      // Mock successful handler response
      authorizeHandlerMock.handler.callsFake((e, c, cb) => {
        cb(null, {
          statusCode: 302,
          headers: {
            Location: 'https://github.com/login/oauth/authorize?client_id=test-client'
          }
        });
      });

      // Execute handler
      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          // Verify logging
          expect(loggerMock.info.calledOnce).to.be.true;
          expect(loggerMock.info.firstCall.args[0]).to.include({
            message: 'Lambda invoked',
            version: '1.0.0',
            path: '/authorize',
            method: 'GET'
          });

          // Verify validation
          expect(validatorMock.validate.calledOnce).to.be.true;
          expect(validatorMock.validate.firstCall.args[0]).to.equal('authorize');

          // Verify rate limiter not called
          expect(rateLimiterMock.checkLimit.called).to.be.false;

          // Verify response
          expect(response.statusCode).to.equal(302);
          expect(response.headers).to.include({
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
          });
          expect(response.headers.Location).to.include('https://github.com/login/oauth/authorize');

          resolve();
        });
      });
    });

    it('should handle validation errors', async () => {
      // Setup test data with missing required fields
      const event = {
        path: '/authorize',
        httpMethod: 'GET',
        queryStringParameters: {
          client_id: 'test-client'
          // Missing required fields
        },
        headers: {}
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      // Mock validation error
      validatorMock.validate.throws(new Error('Missing required fields'));

      // Execute handler
      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          // Verify error response
          expect(response.statusCode).to.equal(400);
          expect(JSON.parse(response.body)).to.deep.equal({
            error: 'invalid_request',
            error_description: 'Missing required fields'
          });

          // Verify proper headers
          expect(response.headers).to.include({
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json'
          });

          resolve();
        });
      });
    });

    it('should handle method not allowed', async () => {
      // Setup test data with invalid method
      const event = {
        path: '/authorize',
        httpMethod: 'PUT',
        headers: {}
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      // Execute handler
      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          // Verify error response
          expect(response.statusCode).to.equal(405);
          expect(JSON.parse(response.body)).to.deep.equal({
            error: 'method_not_allowed',
            error_description: 'Method PUT not allowed'
          });

          resolve();
        });
      });
    });

    it('should handle CORS preflight requests', async () => {
      const event = {
        path: '/authorize',
        httpMethod: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Origin': 'https://example.com'
        }
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          expect(response.statusCode).to.equal(204);
          expect(response.headers).to.include({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
          });
          resolve();
        });
      });
    });
  });

  describe('Token Endpoint', () => {
    it('should process a valid token request', async () => {
      const event = {
        path: '/token',
        httpMethod: 'POST',
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: 'test-code',
          redirect_uri: 'https://example.com/callback',
          client_id: 'test-client',
          code_verifier: 'test-verifier'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      validatorMock.validate.returns(true);
      tokenHandlerMock.handler.callsFake((e, c, cb) => {
        cb(null, {
          statusCode: 200,
          body: JSON.stringify({
            access_token: 'test-token',
            token_type: 'Bearer',
            expires_in: 3600
          })
        });
      });

      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          expect(rateLimiterMock.checkLimit.calledOnce).to.be.true;
          expect(response.statusCode).to.equal(200);
          expect(response.headers['Cache-Control']).to.equal('no-store');
          resolve();
        });
      });
    });

    it('should handle rate limit errors', async () => {
      const event = {
        path: '/token',
        httpMethod: 'POST',
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: 'test-code'
        }),
        headers: {}
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      rateLimiterMock.checkLimit.rejects(new Error('Rate limit exceeded'));
      rateLimiterMock.isRateLimitError.returns(true);

      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          expect(response.statusCode).to.equal(429);
          expect(response.headers['Retry-After']).to.equal('60');
          resolve();
        });
      });
    });
  });

  describe('Userinfo Endpoint', () => {
    it('should process a valid userinfo request', async () => {
      const event = {
        path: '/userinfo',
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      validatorMock.validate.returns(true);
      userinfoHandlerMock.handler.callsFake((e, c, cb) => {
        cb(null, {
          statusCode: 200,
          body: JSON.stringify({
            sub: 'test-user',
            name: 'Test User'
          })
        });
      });

      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          expect(rateLimiterMock.checkLimit.calledOnce).to.be.true;
          expect(response.statusCode).to.equal(200);
          expect(response.headers['Cache-Control']).to.equal('no-store');
          resolve();
        });
      });
    });
  });

  describe('JWKS Endpoint', () => {
    it('should serve public keys with caching', async () => {
      const event = {
        path: '/.well-known/jwks.json',
        httpMethod: 'GET',
        headers: {}
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      jwksHandlerMock.handler.callsFake((e, c, cb) => {
        cb(null, {
          statusCode: 200,
          body: JSON.stringify({ keys: [] })
        });
      });

      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          expect(rateLimiterMock.checkLimit.called).to.be.false;
          expect(response.statusCode).to.equal(200);
          expect(response.headers['Cache-Control']).to.equal('public, max-age=86400');
          resolve();
        });
      });
    });
  });

  describe('OpenID Configuration Endpoint', () => {
    it('should serve configuration with caching', async () => {
      const event = {
        path: '/.well-known/openid-configuration',
        httpMethod: 'GET',
        headers: {}
      };

      const context = {
        awsRequestId: 'test-request-id'
      };

      openIdConfigurationHandlerMock.handler.callsFake((e, c, cb) => {
        cb(null, {
          statusCode: 200,
          body: JSON.stringify({
            issuer: 'https://example.com',
            authorization_endpoint: 'https://example.com/authorize'
          })
        });
      });

      await new Promise((resolve) => {
        handler(event, context, (error, response) => {
          expect(rateLimiterMock.checkLimit.called).to.be.false;
          expect(response.statusCode).to.equal(200);
          expect(response.headers['Cache-Control']).to.equal('public, max-age=86400');
          resolve();
        });
      });
    });
  });
});

module.exports = {};
