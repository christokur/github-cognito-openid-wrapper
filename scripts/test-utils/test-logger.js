const winston = require('winston');

// Create logger instance with custom formatting
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, prefix, ...metadata }) => {
      // Format the metadata
      const relevantData = {};
      if (metadata.method) relevantData.method = metadata.method;
      if (metadata.path) relevantData.path = metadata.path;
      if (metadata.status) relevantData.status = metadata.status;
      if (metadata.error) relevantData.error = metadata.error;
      if (metadata.version) relevantData.version = metadata.version;
      if (metadata.expected) relevantData.expected = metadata.expected;
      if (metadata.actual) relevantData.actual = metadata.actual;

      // Build the output string
      let output = `[${timestamp}] ${level} ${prefix || 'Test'}: ${message}`;
      
      // Add metadata if present
      if (Object.keys(relevantData).length > 0) {
        const formattedData = Object.entries(relevantData)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ');
        output += ` (${formattedData})`;
      }
      
      return output;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
});

// Add convenience methods for sections and results
logger.section = (title) => {
  console.log(`\n=== ${title} ===\n`);
};

logger.result = (message) => {
  console.log(message);
};

module.exports = logger;
