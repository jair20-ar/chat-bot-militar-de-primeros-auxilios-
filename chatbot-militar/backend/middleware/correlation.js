const crypto = require('crypto');

/**
 * Middleware que genera un UUID de correlación por cada request
 * y lo adjunta en req.correlationId y en el header X-Correlation-ID.
 * @param {import('express').Request} req - Objeto de solicitud Express
 * @param {import('express').Response} res - Objeto de respuesta Express
 * @param {import('express').NextFunction} next - Función para continuar al siguiente middleware
 * @returns {void}
 */
function correlationMiddleware(req, res, next) {
  const correlationId = crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

module.exports = { correlationMiddleware };