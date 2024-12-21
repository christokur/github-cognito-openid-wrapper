const responder = require('./responder');
const auth = require('./auth');
const controllers = require('../controllers');

module.exports = {
  userinfo: (req, res) => {
    controllers(responder(res)).userinfo(auth.getBearerToken(req));
  },
  token: (req, res) => {
    const code = req.body.code || req.query.code;
    const state = req.body.state || req.query.state;

    controllers(responder(res)).token(code, state, req.get('host'));
  },
  jwks: (req, res) => controllers(responder(res)).jwks(),
  authorize: (req, res) => {
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
    responder(res).redirect(
      `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=${scope}&state=${state}&response_type=${response_type}`,
    );
  },
  openIdConfiguration: (req, res) => {
    controllers(responder(res)).openIdConfiguration(
      auth.getIssuer(req.get('host')),
    );
  },
};
