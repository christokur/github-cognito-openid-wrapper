const logger = require('./connectors/logger');
const { NumericDate } = require('./helpers');
const crypto = require('./crypto');
const githubClient = require('./github');
const config = require('./config');
const base64url = require('base64url');

// PKCE helper functions
const generateCodeVerifier = () => {
  return base64url(crypto.randomBytes(32));
};

const generateCodeChallenge = (verifier) => {
  const hash = crypto.createHash('sha256');
  hash.update(verifier);
  return base64url(hash.digest());
};

const validateNonce = (storedNonce, receivedNonce) => {
  if (!storedNonce || !receivedNonce) {
    throw new Error('Nonce is required');
  }
  if (storedNonce !== receivedNonce) {
    throw new Error('Invalid nonce');
  }
};

const getJwks = () => {
  try {
    logger.debug({
      message: 'Getting JWKS',
      memoryUsage: process.memoryUsage()
    });

    const keys = [crypto.getPublicKey()];

    logger.debug({
      message: 'Retrieved JWKS',
      keyCount: keys.length,
      memoryUsage: process.memoryUsage()
    });

    return { keys };
  } catch (error) {
    logger.error({
      message: 'Failed to get JWKS',
      error: error.message || error,
      memoryUsage: process.memoryUsage()
    });
    throw error;
  }
};

/**
 * Fetches user information from GitHub and returns the OpenID claims.
 *
 * @param {string} accessToken - The access token to use for authentication.
 * @returns {Promise<Object>} A promise that resolves to the OpenID claims.
 */
const getUserInfo = (accessToken) => {
  try {
    const githubClientInstance = githubClient(
      config.GITHUB_API_URL,
      config.GITHUB_LOGIN_URL,
    );

    const userDetails = githubClientInstance.getUserDetails(accessToken);
    logger.debug({
      message: 'Fetched user details',
      userDetails,
    });

    // Here we map the github user response to the standard claims from
    // OpenID. The mapping was constructed by following
    // https://developer.github.com/v3/users/
    // and http://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
    const claims = {
      sub: `${userDetails.id}`, // OpenID requires a string
      name: userDetails.name,
      preferred_username: userDetails.login,
      profile: userDetails.html_url,
      picture: userDetails.avatar_url,
      website: userDetails.blog,
      updated_at: NumericDate(
        // OpenID requires the seconds since epoch in UTC
        new Date(Date.parse(userDetails.updated_at)),
      ),
    };
    logger.debug({
      message: 'Resolved claims',
      claims,
    });

    const userEmails = githubClientInstance.getUserEmails(accessToken);
    logger.debug({
      message: 'Fetched user emails',
      userEmails,
    });

    const primaryEmail = userEmails.find((email) => email.primary);
    if (primaryEmail === undefined) {
      throw new Error('User did not have a primary email address');
    }

    const emailClaims = {
      email: primaryEmail.email,
      email_verified: primaryEmail.verified,
    };

    return {
      ...claims,
      ...emailClaims,
    };
  } catch (error) {
    logger.error({
      message: 'Failed to fetch user info',
      error: error.message || error,
    });
    throw error;
  }
};

const getAuthorizeUrl = (client_id, scope, state, response_type, nonce) => {
  try {
    logger.debug({
      message: 'Generating authorize URL',
      client_id,
      scope,
      state,
      response_type,
      nonce,
      memoryUsage: process.memoryUsage()
    });

    if (!client_id) {
      throw new Error('client_id is required');
    }
    if (!scope) {
      throw new Error('scope is required');
    }
    if (!state) {
      throw new Error('state is required');
    }
    if (!response_type) {
      throw new Error('response_type is required');
    }
    if (!nonce) {
      throw new Error('nonce is required');
    }

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const url = githubClient(config.GITHUB_API_URL, config.GITHUB_LOGIN_URL)
      .getAuthorizeUrl(client_id, scope, state, response_type, nonce, codeChallenge);

    // Store PKCE and nonce values (should be in a secure session store in production)
    process.env.CODE_VERIFIER = codeVerifier;
    process.env.NONCE = nonce;

    logger.debug({
      message: 'Generated authorize URL',
      url,
      memoryUsage: process.memoryUsage()
    });

    return url;
  } catch (error) {
    logger.error({
      message: 'Failed to generate authorize URL',
      error: error.message || error,
      memoryUsage: process.memoryUsage()
    });
    throw error;
  }
};

const getTokens = (code, state, host, nonce) => {
  logger.debug({
    message: 'Getting tokens',
    code,
    state,
    host,
    nonce,
    memoryUsage: process.memoryUsage(),
  });
  
  const memBefore = process.memoryUsage();
  logger.debug({
    message: 'Memory usage before GitHub token flow',
    memBefore,
  });
  
  try {
    // Validate nonce
    validateNonce(process.env.NONCE, nonce);
    
    // Get code verifier from secure storage
    const codeVerifier = process.env.CODE_VERIFIER;
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    const githubToken = githubClient(config.GITHUB_API_URL, config.GITHUB_LOGIN_URL)
      .getToken(code, state, codeVerifier);

    // Clear sensitive data
    delete process.env.CODE_VERIFIER;
    delete process.env.NONCE;

    const memAfter = process.memoryUsage();
    logger.debug({
      message: 'Memory usage after GitHub token response',
      memAfter,
    });
    logger.debug({
      message: 'Got GitHub token response',
      githubToken,
    });
    
    // GitHub returns scopes separated by commas
    // But OAuth wants them to be spaces
    // https://tools.ietf.org/html/rfc6749#section-5.1
    // Also, we need to add openid as a scope,
    // since GitHub will have stripped it
    const scope = `openid ${githubToken.scope.replace(/,/g, ' ')}`;

    const memBeforeToken = process.memoryUsage();
    logger.debug({
      message: 'Memory usage before ID token creation',
      memBeforeToken,
    });
    
    const payload = {
      nonce: nonce, // Include nonce in the token payload
      // This was commented because Cognito times out in under a second
      // and generating the userInfo takes too long.
      // It means the ID token is empty except for metadata.
      //  ...userInfo,
    };

    logger.debug({
      message: 'Creating ID token with payload',
      payload,
    });
    const idToken = crypto.makeIdToken(payload, host);
    const tokenResponse = {
      ...githubToken,
      scope,
      id_token: idToken,
    };

    const memAfterToken = process.memoryUsage();
    logger.debug({
      message: 'Memory usage after ID token creation',
      memAfterToken,
    });
    logger.debug({
      message: 'Final token response',
      tokenResponse,
    });
    return tokenResponse;
  } catch (error) {
    logger.error({
      message: 'Failed in GitHub token flow',
      error: error.message || error,
      memoryUsage: process.memoryUsage(),
    });
    throw error;
  }
};

const getConfigFor = (host) => {
  try {
    logger.debug({
      message: 'Getting OpenID configuration',
      host,
      memoryUsage: process.memoryUsage()
    });

    if (!host) {
      throw new Error('Host is required');
    }
    //  if host already has a `http?://` prefix do nothing else add it
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = `https://${host}`;
    }

    const configuration = {
      issuer: `${host}`,
      authorization_endpoint: `${host}/authorize`,
      token_endpoint: `${host}/token`,
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'private_key_jwt',
      ],
      token_endpoint_auth_signing_alg_values_supported: ['RS256'],
      userinfo_endpoint: `${host}/userinfo`,
      jwks_uri: `${host}/.well-known/jwks.json`,
      scopes_supported: ['openid', 'read:user', 'user:email'],
      response_types_supported: ['code', 'code id_token'],
      response_modes_supported: ['query', 'fragment'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      userinfo_signing_alg_values_supported: ['none'],
      id_token_signing_alg_values_supported: ['RS256'],
      request_object_signing_alg_values_supported: ['none'],
      claims_supported: [
        'sub',
        'name',
        'preferred_username',
        'profile',
        'picture',
        'website',
        'email',
        'email_verified',
        'updated_at',
        'iss',
        'aud'
      ],
      code_challenge_methods_supported: ['plain', 'S256']
    };

    logger.debug({
      message: 'Retrieved OpenID configuration',
      configuration,
      memoryUsage: process.memoryUsage()
    });

    return configuration;
  } catch (error) {
    logger.error({
      message: 'Failed to get OpenID configuration',
      error: error.message || error,
      memoryUsage: process.memoryUsage()
    });
    throw error;
  }
};

module.exports = {
  getTokens,
  getUserInfo,
  getJwks,
  getConfigFor,
  getAuthorizeUrl,
};
