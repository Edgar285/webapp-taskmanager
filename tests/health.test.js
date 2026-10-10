const request = require('supertest');
const app = require('../src/app');
const { db } = require('../src/db/database');
const { version } = require('../package.json');

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.GIT_SHA;
});

describe('GET /api/health - estado del servicio', () => {
  test('responde 200 con status ok y la base de datos disponible', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok2', database: 'ok', version });
    expect(typeof res.body.data.uptime_s).toBe('number');
    expect(new Date(res.body.data.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('sin GIT_SHA reporta commit "local"', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.data.commit).toBe('local');
  });

  test('reporta el hash del commit con el que se construyo la imagen', async () => {
    process.env.GIT_SHA = 'abc123def456';
    const res = await request(app).get('/api/health');
    expect(res.body.data.commit).toBe('abc123def456');
  });

  test('ERROR: si la base de datos falla responde 503 (degraded)', async () => {
    jest.spyOn(db, 'prepare').mockImplementation(() => {
      throw new Error('disco lleno');
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.data).toMatchObject({ status: 'degraded', database: 'error' });
  });

  test('ERROR: metodo no permitido (POST) -> 404', async () => {
    const res = await request(app).post('/api/health');
    expect(res.status).toBe(404);
  });
});
