#!/usr/bin/env node

// Set log level from CLI argument or default to 'info'
const args = process.argv.slice(2);
const LOG_LEVEL = args[0]?.toLowerCase() || 'info';

// Set environment variable before requiring logger
process.env.LOG_LEVEL = LOG_LEVEL;

const express = require('express');
const logger = require('../src/connectors/logger');

const app = express();
app.use(express.json());

// Mock OIDC configuration
const config = {
  issuer: 'http://localhost:3000',
  authorization_endpoint: 'http://localhost:3000/authorize',
  token_endpoint: 'http://localhost:3000/token',
  userinfo_endpoint: 'http://localhost:3000/userinfo',
  jwks_uri: 'http://localhost:3000/jwks',
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  scopes_supported: ['openid', 'profile', 'email'],
  token_endpoint_auth_methods_supported: ['client_secret_basic'],
  claims_supported: ['sub', 'iss', 'name', 'email']
};

// Mock JWKS
const jwks = {
  keys: [{
    kty: 'RSA',
    kid: 'mock-key-1',
    use: 'sig',
    alg: 'RS256',
    n: 'mock-modulus',
    e: 'AQAB'
  }]
};

// OIDC endpoints
app.get('/.well-known/openid-configuration', (req, res) => {
  logger.debug('Handling OpenID Configuration request', {
    endpoint: '/.well-known/openid-configuration',
    headers: req.headers
  });
  
  logger.info('OpenID Configuration requested', {
    endpoint: '/.well-known/openid-configuration'
  });
  
  res.json(config);
});

app.get('/jwks', (req, res) => {
  logger.debug('Handling JWKS request', {
    endpoint: '/jwks',
    headers: req.headers
  });
  
  logger.info('JWKS requested', {
    endpoint: '/jwks'
  });
  
  res.json(jwks);
});

app.get('/authorize', (req, res) => {
  const { response_type, client_id, redirect_uri, scope, state } = req.query;
  
  logger.debug('Handling Authorization request', {
    endpoint: '/authorize',
    headers: req.headers,
    query: req.query
  });
  
  logger.info('Authorization requested', {
    endpoint: '/authorize',
    query: req.query
  });

  // Validate required parameters
  if (!response_type || !client_id || !redirect_uri) {
    logger.warn('Missing required parameters', {
      endpoint: '/authorize',
      params: { response_type, client_id, redirect_uri }
    });
    
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters'
    });
  }

  // Instead of redirecting, return the URL that would be redirected to
  const redirectUrl = `${redirect_uri}?code=mock_code&state=${state || ''}`;
  
  // Return 302 with Location header
  res.status(302).json({
    statusCode: 302,
    headers: {
      Location: redirectUrl
    }
  });
});

app.post('/token', (req, res) => {
  logger.debug('Handling Token request', {
    endpoint: '/token',
    headers: req.headers,
    body: req.body
  });
  
  logger.info('Token requested', {
    endpoint: '/token',
    body: req.body
  });

  // Validate required parameters
  if (!req.body.grant_type || !req.body.code || !req.body.redirect_uri) {
    logger.warn('Missing required parameters', {
      endpoint: '/token',
      body: req.body
    });
    
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters'
    });
  }

  res.json({
    access_token: 'mock_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: 'mock_id_token'
  });
});

app.get('/userinfo', (req, res) => {
  const auth = req.headers.authorization;
  
  logger.debug('Handling Userinfo request', {
    endpoint: '/userinfo',
    headers: req.headers
  });
  
  logger.info('Userinfo requested', {
    endpoint: '/userinfo',
    authorization: auth
  });

  if (!auth || !auth.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', {
      endpoint: '/userinfo',
      authorization: auth
    });
    
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid authorization header'
    });
  }

  // Validate token (in this case, just check if it's our mock token)
  if (auth !== 'Bearer mock_access_token') {
    logger.warn('Invalid token', {
      endpoint: '/userinfo',
      authorization: auth
    });
    
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Invalid token'
    });
  }

  res.json({
    sub: 'mock_user_id',
    name: 'Mock User',
    email: 'mock@example.com'
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Server error', {
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({
    error: 'server_error',
    error_description: err.message
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Mock OIDC server started on port ${port} with log level ${LOG_LEVEL}`);
  logger.debug('Debug logging enabled');
});
