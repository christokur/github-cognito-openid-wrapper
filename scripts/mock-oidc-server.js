#!/usr/bin/env node

// Set log level from CLI argument or default to 'info'
const args = process.argv.slice(2);
const LOG_LEVEL = args[0]?.toLowerCase() || 'info';

// Set environment variable before requiring logger
process.env.LOG_LEVEL = LOG_LEVEL;

const express = require('express');
const logger = require('../src/connectors/logger');

const app = express();

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Parse JSON for POST/PUT/PATCH requests
const jsonParser = express.json();
app.post('*', jsonParser);
app.put('*', jsonParser);
app.patch('*', jsonParser);

// Server version
const SERVER_VERSION = '0.1.0';

// Mock OIDC configuration
const config = {
  issuer: 'http://localhost:3000',
  authorization_endpoint: 'http://localhost:3000/authorize',
  token_endpoint: 'http://localhost:3000/token',
  userinfo_endpoint: 'http://localhost:3000/userinfo',
  jwks_uri: 'http://localhost:3000/.well-known/jwks.json',
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
// Version endpoint (only available on mock server)
app.get('/version', (req, res) => {
  res.json({ version: SERVER_VERSION });
});

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

app.get('/.well-known/jwks.json', (req, res) => {
  logger.debug('Handling JWKS request', {
    endpoint: '/jwks',
    headers: req.headers
  });
  
  logger.info('JWKS requested', {
    endpoint: '/jwks'
  });
  
  res.json(jwks);
});

// Method handlers for each endpoint
const endpoints = {
  '/authorize': { methods: ['GET'] },
  '/token': { methods: ['POST'] },
  '/userinfo': { methods: ['GET'] }
};

// Generic method handler for all endpoints
Object.entries(endpoints).forEach(([path, config]) => {
  // Handle method not allowed
  app.use(path, (req, res, next) => {
    if (config.methods.includes(req.method)) {
      return next();
    }
    res.status(405).json({
      error: 'invalid_request',
      error_description: 'Method not allowed'
    });
  });

  // Handle allowed methods - just pass through without validation
  config.methods.forEach(method => {
    app[method.toLowerCase()](path, (req, res) => {
      logger.info(`${method} ${path} requested`, {
        endpoint: path,
        method: method,
        query: req.query,
        body: req.body,
        headers: req.headers
      });
      
      // Pass through with 200 OK
      res.json({
        message: `${method} ${path} called`
      });
    });
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
