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
  LOG_LEVEL = 'info'
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
});

// Common format that handles both structured logging and printf-style placeholders
const commonFormat = winston.format.combine(
  winston.format.uncolorize(), // Remove colors
  winston.format.splat(),
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp, ...rest }) => {
    const logEntry = {
      timestamp,
      level,
      message: typeof message === 'object' ? message : { message }
    };

    // Add any additional fields
    Object.entries(rest).forEach(([key, value]) => {
      if (key !== Symbol.for('splat')) {
        logEntry[key] = value;
      }
    });

    return JSON.stringify(logEntry);
  })
);

// Activate Splunk logging if Splunk's env variables are set
if (SPLUNK_URL) {
  const SplunkStreamEvent = require('winston-splunk-httplogger');

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
      format: commonFormat,
    }),
  );
} else {
  // STDOUT logging for dev/regular servers
  logger.add(
    new winston.transports.Console({
      format: commonFormat,
    }),
  );
}

// Log the current level on startup
logger.info(`Logger initialized with level: ${logger.level}`);

module.exports = logger;
