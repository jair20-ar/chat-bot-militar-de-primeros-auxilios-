const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fanb-secret-key-cambiame-en-produccion';

/**
 * Genera un token JWT con el payload dado y expiración de 8 horas.
 * @param {object} payload - Datos a incluir en el token (ej: { id, rol, nombre })
 * @returns {string} Token JWT firmado
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

/**
 * Middleware que verifica un token JWT Bearer en el header Authorization.
 * Si es válido, decodifica el payload en req.user y llama a next().
 * @param {import('express').Request} req - Objeto de solicitud Express
 * @param {import('express').Response} res - Objeto de respuesta Express
 * @param {import('express').NextFunction} next - Función para continuar al siguiente middleware
 * @returns {void}
 * @throws {401} Si el token falta, es inválido o está expirado
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acceso requerido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

/**
 * Middleware que verifica que el usuario autenticado tenga rol 'admin'.
 * Debe ejecutarse después de verifyToken.
 * @param {import('express').Request} req - Objeto de solicitud Express
 * @param {import('express').Response} res - Objeto de respuesta Express
 * @param {import('express').NextFunction} next - Función para continuar al siguiente middleware
 * @returns {void}
 * @throws {403} Si el usuario no es administrador
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
}

module.exports = { signToken, verifyToken, requireAdmin };