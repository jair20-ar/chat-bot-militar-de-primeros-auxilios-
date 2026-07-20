const { body, validationResult } = require('express-validator');

/**
 * Middleware que verifica los resultados de express-validator.
 * Si hay errores, retorna el primero con status 400.
 * @param {import('express').Request} req - Objeto de solicitud Express
 * @param {import('express').Response} res - Objeto de respuesta Express
 * @param {import('express').NextFunction} next - Función para continuar
 * @returns {void}
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({ error: firstError.msg });
  }
  next();
}

/** Validación para registro de médico. */
const registroMedico = [
  body('nombre').trim().escape().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres.'),
  body('email').trim().escape().isEmail().withMessage('Email inválido.'),
  body('cedula').trim().escape().matches(/^\d{7,10}$/).withMessage('La cédula debe tener entre 7 y 10 dígitos.'),
  body('especializacion').trim().escape().isLength({ min: 3, max: 100 }).withMessage('La especialización debe tener entre 3 y 100 caracteres.'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'),
  body('codigo_registro').trim().escape().notEmpty().withMessage('El código de registro es obligatorio.'),
  handleValidationErrors
];

/** Validación para inicio de sesión de médico. */
const loginMedico = [
  body('id_medico').trim().escape().notEmpty().withMessage('ID de médico es obligatorio.'),
  body('password').notEmpty().withMessage('Contraseña es obligatoria.'),
  handleValidationErrors
];

/** Validación para inicio de sesión de administrador. */
const loginAdmin = [
  body('password').notEmpty().withMessage('Contraseña es obligatoria.'),
  handleValidationErrors
];

/** Validación para creación/actualización de instrucción médica. */
const instruccion = [
  body('titulo').trim().escape().isLength({ min: 3, max: 200 }).withMessage('El título debe tener entre 3 y 200 caracteres.'),
  body('parte_cuerpo').trim().escape().isLength({ min: 2, max: 100 }).withMessage('La parte del cuerpo debe tener entre 2 y 100 caracteres.'),
  body('descripcion').optional({ values: 'falsy' }).trim().escape().isLength({ max: 2000 }).withMessage('La descripción no debe superar los 2000 caracteres.'),
  body('pasos').customSanitizer((value) => {
    if (Array.isArray(value)) {
      return value.map(p => ({
        ...p,
        titulo: p.titulo ? p.titulo.replace(/[<>&"'\/]/g, '') : p.titulo
      }));
    }
    return value;
  }).custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error('Los pasos deben ser un arreglo.');
    }
    if (value.length === 0) {
      throw new Error('Debe haber al menos un paso.');
    }
    for (let i = 0; i < value.length; i++) {
      if (!value[i].titulo || typeof value[i].titulo !== 'string' || value[i].titulo.trim().length === 0) {
        throw new Error(`El paso ${i + 1} debe tener un título válido.`);
      }
    }
    return true;
  }),
  handleValidationErrors
];

/** Validación para registro de búsqueda de instrucción. */
const logBusqueda = [
  body('instruccion_id').isInt({ min: 1 }).withMessage('ID de instrucción inválido.'),
  handleValidationErrors
];

/** Validación para actualización de configuración del sistema. */
const configUpdate = [
  body('registro_code').optional().trim().escape().isLength({ min: 4, max: 50 }).withMessage('El código de registro debe tener entre 4 y 50 caracteres.'),
  handleValidationErrors
];

module.exports = { registroMedico, loginMedico, loginAdmin, instruccion, logBusqueda, configUpdate };