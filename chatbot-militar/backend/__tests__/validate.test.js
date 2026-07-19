const { registroMedico, loginMedico, loginAdmin, instruccion, logBusqueda, configUpdate } = require('../middleware/validate');

function buildReq(body) {
  return { body };
}

function buildRes() {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
}

function buildNext() {
  return jest.fn();
}

async function runValidation(chain, body) {
  const req = buildReq(body);
  const res = buildRes();
  const next = buildNext();

  for (const middleware of chain) {
    await middleware(req, res, next);
    if (res.json.mock.calls.length > 0) break;
  }

  return { req, res, next };
}

describe('registroMedico', () => {
  it('debe aceptar datos validos', async () => {
    const { res, next } = await runValidation(registroMedico, {
      nombre: 'Dr. Test',
      email: 'test@example.com',
      cedula: '12345678',
      especializacion: 'Medicina General',
      password: 'password123',
      codigo_registro: 'CODE123'
    });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe rechazar nombre corto', async () => {
    const { res } = await runValidation(registroMedico, {
      nombre: 'ab',
      email: 'test@example.com',
      cedula: '12345678',
      especializacion: 'Medicina',
      password: 'password123',
      codigo_registro: 'CODE123'
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe rechazar email invalido', async () => {
    const { res } = await runValidation(registroMedico, {
      nombre: 'Dr. Test',
      email: 'no-email',
      cedula: '12345678',
      especializacion: 'Medicina',
      password: 'password123',
      codigo_registro: 'CODE123'
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe rechazar cedula con menos de 7 digitos', async () => {
    const { res } = await runValidation(registroMedico, {
      nombre: 'Dr. Test',
      email: 'test@example.com',
      cedula: '123',
      especializacion: 'Medicina',
      password: 'password123',
      codigo_registro: 'CODE123'
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe rechazar password menor a 8 caracteres', async () => {
    const { res } = await runValidation(registroMedico, {
      nombre: 'Dr. Test',
      email: 'test@example.com',
      cedula: '12345678',
      especializacion: 'Medicina',
      password: '1234567',
      codigo_registro: 'CODE123'
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe rechazar codigo de registro vacio', async () => {
    const { res } = await runValidation(registroMedico, {
      nombre: 'Dr. Test',
      email: 'test@example.com',
      cedula: '12345678',
      especializacion: 'Medicina',
      password: 'password123',
      codigo_registro: ''
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('loginMedico', () => {
  it('debe aceptar datos validos', async () => {
    const { res, next } = await runValidation(loginMedico, {
      id_medico: '12345678',
      password: 'password123'
    });

    expect(next).toHaveBeenCalled();
  });

  it('debe rechazar id_medico vacio', async () => {
    const { res } = await runValidation(loginMedico, {
      id_medico: '',
      password: 'password123'
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe rechazar password vacio', async () => {
    const { res } = await runValidation(loginMedico, {
      id_medico: '12345678',
      password: ''
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('loginAdmin', () => {
  it('debe aceptar password valido', async () => {
    const { res, next } = await runValidation(loginAdmin, {
      password: 'admin123'
    });

    expect(next).toHaveBeenCalled();
  });

  it('debe rechazar password vacio', async () => {
    const { res } = await runValidation(loginAdmin, { password: '' });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('instruccion', () => {
  it('debe aceptar datos validos', async () => {
    const { res, next } = await runValidation(instruccion, {
      titulo: 'Hemorragia Control',
      parte_cuerpo: 'brazo',
      pasos: [{ titulo: 'Aplicar presion' }]
    });

    expect(next).toHaveBeenCalled();
  });

  it('debe rechazar titulo corto', async () => {
    const { res } = await runValidation(instruccion, {
      titulo: 'ab',
      parte_cuerpo: 'brazo',
      pasos: [{ titulo: 'Paso 1' }]
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe rechazar pasos vacio', async () => {
    const { res } = await runValidation(instruccion, {
      titulo: 'Hemorragia',
      parte_cuerpo: 'brazo',
      pasos: []
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('debe rechazar pasos sin titulo', async () => {
    const { res } = await runValidation(instruccion, {
      titulo: 'Hemorragia',
      parte_cuerpo: 'brazo',
      pasos: [{ titulo: '' }]
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('logBusqueda', () => {
  it('debe aceptar instruccion_id valido', async () => {
    const { res, next } = await runValidation(logBusqueda, {
      instruccion_id: 1
    });

    expect(next).toHaveBeenCalled();
  });

  it('debe rechazar instruccion_id no numerico', async () => {
    const { res } = await runValidation(logBusqueda, {
      instruccion_id: 'abc'
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('configUpdate', () => {
  it('debe aceptar registro_code valido', async () => {
    const { res, next } = await runValidation(configUpdate, {
      registro_code: 'NUEVOCODE'
    });

    expect(next).toHaveBeenCalled();
  });

  it('debe aceptar body vacio (solo admin_password)', async () => {
    const { res, next } = await runValidation(configUpdate, {});

    expect(next).toHaveBeenCalled();
  });
});
