const { v4: uuidv4 } = require('uuid');

function correlationMiddleware(req, res, next) {
  const correlationId = uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

module.exports = { correlationMiddleware };