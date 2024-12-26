const responder = require('./responder');
const auth = require('./auth');
const controllers = require('../controllers');
const { VERSION } = require('../lambda/version');

// List of environment variables that should not be exposed
const SENSITIVE_ENV_VARS = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];

// Function to get safe environment variables
const getSafeEnvironment = () => {
  const safeEnv = {};
  Object.keys(process.env).forEach(key => {
    if (!SENSITIVE_ENV_VARS.includes(key)) {
      safeEnv[key] = process.env[key];
    }
  });
  return safeEnv;
};

module.exports = {
  userinfo: async (req, res) => {
    try {
      const token = await auth.getBearerToken(req);
      await controllers(responder(res)).userinfo(token);
    } catch (error) {
      responder(res).error(error);
    }
  },

  token: async (req, res) => {
    try {
      const code = req.body.code || req.query.code;
      const state = req.body.state || req.query.state;
      await controllers(responder(res)).token(code, state, req.get('host'));
    } catch (error) {
      responder(res).error(error);
    }
  },

  jwks: async (req, res) => {
    try {
      await controllers(responder(res)).jwks();
    } catch (error) {
      responder(res).error(error);
    }
  },

  authorize: async (req, res) => {
    try {
      // Check HTTP method
      if (req.method !== 'GET') {
        return res.sendStatus(405);
      }

      // Validate required parameters
      const { client_id, scope, state, response_type } = req.query;
      if (!client_id || !scope || !state || !response_type) {
        return res.sendStatus(400);
      }

      // Redirect to GitHub
      await responder(res).redirect(
        `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=${scope}&state=${state}&response_type=${response_type}`,
      );
    } catch (error) {
      responder(res).error(error);
    }
  },

  openIdConfiguration: async (req, res) => {
    try {
      const issuer = await auth.getIssuer(req.get('host'));
      await controllers(responder(res)).openIdConfiguration(issuer);
    } catch (error) {
      responder(res).error(error);
    }
  },

  version: (req, res) => {
    responder(res).success({
      version: VERSION,
      environment: getSafeEnvironment()
    });
  },
};
