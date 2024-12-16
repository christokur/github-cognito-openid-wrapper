const winston = require('winston');
const {
  SPLUNK_URL,
  SPLUNK_TOKEN,
  SPLUNK_SOURCE,
  SPLUNK_SOURCETYPE,
  SPLUNK_INDEX,
} = require('../config');

// Get log level from environment variable, default to 'info'
const LOG_LEVEL = process.env.LOG_LEVEL?.toLowerCase() || 'info';

// Validate log level
const validLogLevels = ['error', 'warn', 'info', 'debug'];
if (!validLogLevels.includes(LOG_LEVEL)) {
  console.warn(`Invalid LOG_LEVEL "${LOG_LEVEL}". Using "info" instead. Valid levels are: ${validLogLevels.join(', ')}`);
}

const logger = winston.createLogger({
  level: validLogLevels.includes(LOG_LEVEL) ? LOG_LEVEL : 'info',
});

// Activate Splunk logging if Splunk's env variables are set
if (SPLUNK_URL) {
  const SplunkStreamEvent = require('winston-splunk-httplogger'); // eslint-disable-line global-require

  const splunkSettings = {
    url: SPLUNK_URL || 'localhost',
    token: SPLUNK_TOKEN,
    source: SPLUNK_SOURCE || '/var/log/GHOIdShim.log',
    sourcetype: SPLUNK_SOURCETYPE || 'github-cognito-openid-wrapper',
    index: SPLUNK_INDEX || 'main',
    maxBatchCount: 1,
  };

  logger.add(
    new SplunkStreamEvent({
      splunk: splunkSettings,
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.timestamp(),
      ),
    }),
  );
} else {
  // STDOUT logging for dev/regular servers
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.colorize({ all: true }),
        winston.format.simple(),
      ),
    }),
  );
}

// Log the current level on startup
logger.info(`Logger initialized with level: ${logger.level}`);

module.exports = logger;
