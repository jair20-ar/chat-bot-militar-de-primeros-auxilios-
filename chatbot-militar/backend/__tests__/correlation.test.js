const { correlationMiddleware } = require('../middleware/correlation');

describe('correlationMiddleware', () => {
  it('debe asignar un correlationId al req', () => {
    const req = {};
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    correlationMiddleware(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(typeof req.correlationId).toBe('string');
    expect(req.correlationId.length).toBeGreaterThan(0);
  });

  it('debe establecer el header X-Correlation-ID', () => {
    const req = {};
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    correlationMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', req.correlationId);
  });

  it('debe llamar a next()', () => {
    const req = {};
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    correlationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('debe generar un UUID unico por cada request', () => {
    const req1 = {};
    const req2 = {};
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    correlationMiddleware(req1, res, next);
    correlationMiddleware(req2, res, next);

    expect(req1.correlationId).not.toBe(req2.correlationId);
  });
});
