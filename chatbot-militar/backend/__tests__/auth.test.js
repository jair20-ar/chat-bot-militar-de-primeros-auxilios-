const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

const { signToken, verifyToken, requireAdmin } = require('../middleware/auth');

describe('signToken', () => {
  it('debe firmar un JWT con el payload dado y expiracion de 8h', () => {
    const payload = { id: 1, rol: 'medico' };
    jwt.sign.mockReturnValue('fake-jwt-token');

    const token = signToken(payload);

    expect(jwt.sign).toHaveBeenCalledWith(payload, expect.any(String), { expiresIn: '8h' });
    expect(token).toBe('fake-jwt-token');
  });
});

describe('verifyToken', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('debe retornar 401 si no hay header Authorization', () => {
    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 401 si el header no es Bearer', () => {
    req.headers.authorization = 'Basic token';

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 401 si el token es invalido', () => {
    req.headers.authorization = 'Bearer invalid-token';
    jwt.verify.mockImplementation(() => { throw new Error('jwt malformed'); });

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('debe llamar next() si el token es valido y decodificar el payload en req.user', () => {
    req.headers.authorization = 'Bearer valid-token';
    const decoded = { id: 1, rol: 'medico' };
    jwt.verify.mockReturnValue(decoded);

    verifyToken(req, res, next);

    expect(req.user).toEqual(decoded);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('debe retornar 403 si req.user no existe', () => {
    req.user = null;

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 403 si el rol no es admin', () => {
    req.user.rol = 'medico';

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('debe llamar next() si el usuario es admin', () => {
    req.user.rol = 'admin';

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
