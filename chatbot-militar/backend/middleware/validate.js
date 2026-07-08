const { body, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({ error: firstError.msg });
  }
  next();
}

const registroMedico = [
  body('nombre').trim().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres.'),
  body('email').trim().isEmail().withMessage('Email inválido.'),
  body('cedula').trim().matches(/^\d{7,10}$/).withMessage('La cédula debe tener entre 7 y 10 dígitos.'),
  body('especializacion').trim().isLength({ min: 3, max: 100 }).withMessage('La especialización debe tener entre 3 y 100 caracteres.'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'),
  body('codigo_registro').trim().notEmpty().withMessage('El código de registro es obligatorio.'),
  handleValidationErrors
];

const loginMedico = [
  body('id_medico').trim().notEmpty().withMessage('ID de médico es obligatorio.'),
  body('password').notEmpty().withMessage('Contraseña es obligatoria.'),
  handleValidationErrors
];

const loginAdmin = [
  body('password').notEmpty().withMessage('Contraseña es obligatoria.'),
  handleValidationErrors
];

const instruccion = [
  body('titulo').trim().isLength({ min: 3, max: 200 }).withMessage('El título debe tener entre 3 y 200 caracteres.'),
  body('parte_cuerpo').trim().isLength({ min: 2, max: 100 }).withMessage('La parte del cuerpo debe tener entre 2 y 100 caracteres.'),
  body('pasos').custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error('Los pasos deben ser un arreglo.');
    }
    if (value.length === 0) {
      throw new Error('Debe haber al menos un paso.');
    }
    for (let i = 0; i < value.length; i++) {
      if (!value[i].texto || typeof value[i].texto !== 'string' || value[i].texto.trim().length === 0) {
        throw new Error(`El paso ${i + 1} debe tener un texto válido.`);
      }
    }
    return true;
  }),
  handleValidationErrors
];

const logBusqueda = [
  body('instruccion_id').isInt({ min: 1 }).withMessage('ID de instrucción inválido.'),
  handleValidationErrors
];

const configUpdate = [
  body('registro_code').optional().trim().isLength({ min: 4, max: 50 }).withMessage('El código de registro debe tener entre 4 y 50 caracteres.'),
  handleValidationErrors
];

module.exports = { registroMedico, loginMedico, loginAdmin, instruccion, logBusqueda, configUpdate };