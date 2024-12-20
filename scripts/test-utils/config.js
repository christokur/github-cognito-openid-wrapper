const minimist = require('minimist');

const validLogLevels = ['error', 'warn', 'info', 'debug'];

function parseConfig(argv) {
  const args = minimist(argv.slice(2), {
    string: ['url', 'log-level'],
    default: {
      url: 'http://localhost:3000',
      'log-level': 'info'
    }
  });

  if (args.h || args.help) {
    showHelp();
    process.exit(0);
  }

  process.env.LOG_LEVEL = args['log-level'];
  
  return {
    baseUrl: args.url,
    logLevel: args['log-level'],
    isLocalhost: args.url.includes('localhost')
  };
}

function showHelp() {
  console.log(`
Usage: ./test-endpoints.js [options]

Options:
  --url        Base URL of the API to test (default: http://localhost:3000)
  --log-level  One of: ${validLogLevels.join(', ')} (default: info)
  -h, --help   Show this help message

Examples:
  ./test-endpoints.js --url https://api.example.com  # Test production API
  ./test-endpoints.js --log-level debug             # Test local API with debug logging
  `);
}

module.exports = {
  parseConfig,
  showHelp
};
