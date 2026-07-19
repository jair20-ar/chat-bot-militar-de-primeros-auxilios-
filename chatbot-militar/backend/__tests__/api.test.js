jest.mock('../db', () => require('./helpers/testDb'));

jest.mock('vosk', () => ({
  Model: jest.fn(),
  Recognizer: jest.fn()
}));

jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn(() => mockFfmpeg);
  mockFfmpeg.toFormat = jest.fn().mockReturnThis();
  mockFfmpeg.audioChannels = jest.fn().mockReturnThis();
  mockFfmpeg.audioFrequency = jest.fn().mockReturnThis();
  mockFfmpeg.on = jest.fn().mockReturnThis();
  mockFfmpeg.save = jest.fn();
  mockFfmpeg.setFfmpegPath = jest.fn();
  return mockFfmpeg;
});

jest.mock('ffmpeg-static', () => '/fake/ffmpeg/path');

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: (filePath) => {
      if (typeof filePath === 'string' && filePath.includes('vosk-model-small-es-0.42')) {
        return true;
      }
      return actual.existsSync(filePath);
    },
    mkdirSync: jest.fn(),
    createReadStream: jest.fn(() => ({
      on: jest.fn(),
      pipe: jest.fn()
    })),
    unlinkSync: jest.fn()
  };
});

const request = require('supertest');
const app = require('../server');

describe('API Endpoints', () => {
  let medicoToken;
  let adminToken;
  let instruccionId;

  describe('GET /api/health', () => {
    it('debe retornar status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /medicos/registro', () => {
    it('debe registrar un nuevo medico con codigo valido', async () => {
      const res = await request(app)
        .post('/medicos/registro')
        .send({
          nombre: 'Dr. Test',
          email: 'test@example.com',
          cedula: '12345678',
          especializacion: 'Medicina General',
          password: 'password123',
          codigo_registro: '31150106'
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.id).toBeDefined();
    });

    it('debe rechazar codigo de registro invalido', async () => {
      const res = await request(app)
        .post('/medicos/registro')
        .send({
          nombre: 'Dr. Fake',
          email: 'fake@example.com',
          cedula: '87654321',
          especializacion: 'Cirugia',
          password: 'password123',
          codigo_registro: 'WRONG'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('inválido');
    });

    it('debe rechazar datos invalidos (validacion)', async () => {
      const res = await request(app)
        .post('/medicos/registro')
        .send({
          nombre: 'ab',
          email: 'no-email',
          cedula: '123',
          especializacion: 'Med',
          password: '123',
          codigo_registro: ''
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /medicos/login', () => {
    it('debe loguear un medico registrado', async () => {
      const res = await request(app)
        .post('/medicos/login')
        .send({
          id_medico: '12345678',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.nombre).toBe('Dr. Test');
      medicoToken = res.body.token;
    });

    it('debe rechazar credenciales incorrectas', async () => {
      const res = await request(app)
        .post('/medicos/login')
        .send({
          id_medico: '12345678',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/login', () => {
    it('debe loguear admin con contraseña por defecto', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ password: 'UNEFA2026' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      adminToken = res.body.token;
    });

    it('debe rechazar contraseña admin incorrecta', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/instrucciones', () => {
    it('debe crear una instruccion con token valido', async () => {
      const res = await request(app)
        .post('/api/instrucciones')
        .set('Authorization', `Bearer ${medicoToken}`)
        .send({
          titulo: 'Control de Hemorragia',
          categoria: 'Trauma',
          severidad: 'critico',
          parte_cuerpo: 'brazo',
          tiempo_estimado: '5 min',
          pasos: [{ titulo: 'Aplicar presion directa' }, { titulo: 'Elevar miembro' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBeDefined();
      instruccionId = res.body.id;
    });

    it('debe rechazar creacion sin token', async () => {
      const res = await request(app)
        .post('/api/instrucciones')
        .send({
          titulo: 'Test',
          parte_cuerpo: 'brazo',
          pasos: [{ titulo: 'Paso 1' }]
        });

      expect(res.status).toBe(401);
    });

    it('debe rechazar datos invalidos de instruccion', async () => {
      const res = await request(app)
        .post('/api/instrucciones')
        .set('Authorization', `Bearer ${medicoToken}`)
        .send({
          titulo: 'ab',
          parte_cuerpo: 'a',
          pasos: []
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/instrucciones', () => {
    it('debe listar todas las instrucciones', async () => {
      const res = await request(app).get('/api/instrucciones');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/instrucciones/:id', () => {
    it('debe obtener una instruccion por ID', async () => {
      const res = await request(app).get(`/api/instrucciones/${instruccionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.titulo).toBe('Control de Hemorragia');
    });

    it('debe retornar 404 si la instruccion no existe', async () => {
      const res = await request(app).get('/api/instrucciones/99999');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/instrucciones/:id', () => {
    it('debe actualizar una instruccion como propietario', async () => {
      const res = await request(app)
        .put(`/api/instrucciones/${instruccionId}`)
        .set('Authorization', `Bearer ${medicoToken}`)
        .send({
          titulo: 'Hemorragia Control - Actualizado',
          parte_cuerpo: 'brazo',
          pasos: [{ titulo: 'Nuevo paso' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/log-busqueda', () => {
    it('debe registrar una busqueda', async () => {
      const res = await request(app)
        .post('/api/log-busqueda')
        .send({ instruccion_id: instruccionId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('debe rechazar instruccion_id invalido', async () => {
      const res = await request(app)
        .post('/api/log-busqueda')
        .send({ instruccion_id: -1 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/instrucciones/:id', () => {
    it('debe eliminar una instruccion como propietario', async () => {
      const res = await request(app)
        .delete(`/api/instrucciones/${instruccionId}`)
        .set('Authorization', `Bearer ${medicoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/medicos', () => {
    it('debe listar medicos como admin', async () => {
      const res = await request(app)
        .get('/api/admin/medicos')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('debe rechazar con token de medico', async () => {
      const res = await request(app)
        .get('/api/admin/medicos')
        .set('Authorization', `Bearer ${medicoToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/config', () => {
    it('debe obtener config como admin', async () => {
      const res = await request(app)
        .get('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config).toBeDefined();
      expect(res.body.stats).toBeDefined();
    });
  });

  describe('404 handler', () => {
    it('debe retornar 404 para rutas inexistentes', async () => {
      const res = await request(app).get('/ruta-inexistente');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ruta no encontrada.');
    });
  });
});
