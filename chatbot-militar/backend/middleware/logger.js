const winston = require('winston');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

function logEvent(eventType, data = {}) {
  logger.info({ event: eventType, ...data });
}

function logError(eventType, error, data = {}) {
  logger.error({
    event: eventType,
    message: error.message || String(error),
    stack: error.stack,
    ...data
  });
}

module.exports = { logger, logEvent, logError };