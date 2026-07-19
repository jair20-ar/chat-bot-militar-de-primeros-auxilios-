const { logEvent, logError } = require('../middleware/logger');

describe('logEvent', () => {
  it('debe ejecutarse sin lanzar excepcion', () => {
    expect(() => {
      logEvent('TEST_EVENT', { key: 'value' });
    }).not.toThrow();
  });

  it('debe funcionar sin datos adicionales', () => {
    expect(() => {
      logEvent('TEST_EVENT');
    }).not.toThrow();
  });
});

describe('logError', () => {
  it('debe ejecutarse sin lanzar excepcion con un Error', () => {
    expect(() => {
      logError('TEST_ERROR', new Error('algo salio mal'));
    }).not.toThrow();
  });

  it('debe funcionar con un string como error', () => {
    expect(() => {
      logError('TEST_ERROR', 'error message string');
    }).not.toThrow();
  });

  it('debe funcionar con datos adicionales', () => {
    expect(() => {
      logError('TEST_ERROR', new Error('test'), { correlationId: 'abc' });
    }).not.toThrow();
  });
});
