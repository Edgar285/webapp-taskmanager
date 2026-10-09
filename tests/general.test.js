const request = require('supertest');
const app = require('../src/app');

describe('GET / - healthcheck', () => {
  test('responde 200 con el schema normalizado', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.statusCode).toBe(200);
    // No se compara el texto exacto: el mensaje puede cambiar (demo del pipeline)
    expect(typeof res.body.data.mensaje).toBe('string');
    expect(res.body.data.mensaje.length).toBeGreaterThan(0);
    expect(res.body.data.version).toBe(require('../package.json').version);
  });
});

describe('Errores generales del consumidor de la API', () => {
  test('ERROR: ruta inexistente -> 404 con el schema normalizado', async () => {
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ statusCode: 404, data: { mensaje: 'Ruta no encontrada' } });
  });

  test('ERROR: metodo no soportado en una ruta existente -> 404', async () => {
    const res = await request(app).patch('/api/categorias/1');
    expect(res.status).toBe(404);
  });

  test('ERROR: body mayor a 100kb -> 413', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'x'.repeat(150 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.statusCode).toBe(413);
  });

  test('statusCode del body siempre coincide con el codigo HTTP', async () => {
    const rutas = ['/', '/api/tareas', '/api/tareas/abc', '/api/tareas/999', '/no-existe'];
    for (const ruta of rutas) {
      const res = await request(app).get(ruta);
      expect(res.body.statusCode).toBe(res.status);
    }
  });
});
