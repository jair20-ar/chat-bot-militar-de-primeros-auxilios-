const crypto = require('crypto');

function correlationMiddleware(req, res, next) {
  const correlationId = crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

module.exports = { correlationMiddleware };