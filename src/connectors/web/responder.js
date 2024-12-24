const util = require('util');

require('colors');

module.exports = (res) => ({
  success: async (data) => {
    res.format({
      'application/json': () => {
        res.json(data);
      },
      default: () => {
        res.status(406).send('Not Acceptable');
      },
    });
  },
  error: async (error) => {
    res.statusCode = 400;
    res.end(`Failure: ${util.inspect(error.message)}`);
  },
  redirect: async (url) => res.redirect(url),
});
