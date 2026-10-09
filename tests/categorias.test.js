const request = require('supertest');
const app = require('../src/app');
const { resetDb } = require('../src/db/database');

beforeEach(() => {
  resetDb(); // categorias iniciales: 1 Trabajo, 2 Personal, 3 Estudio
});

// ---------------------------------------------------------------------------
// 7. GET /api/categorias
// ---------------------------------------------------------------------------
describe('GET /api/categorias - listar categorias', () => {
  test('devuelve 200 con las 3 categorias iniciales', async () => {
    const res = await request(app).get('/api/categorias');
    expect(res.status).toBe(200);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data.map((c) => c.nombre)).toEqual(['Trabajo', 'Personal', 'Estudio']);
  });
});

// ---------------------------------------------------------------------------
// 8. GET /api/categorias/:id
// ---------------------------------------------------------------------------
describe('GET /api/categorias/:id - obtener una categoria', () => {
  test('devuelve 200 con la categoria solicitada', async () => {
    const res = await request(app).get('/api/categorias/1');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 1, nombre: 'Trabajo' });
  });

  test('ERROR: categoria que no existe -> 404', async () => {
    const res = await request(app).get('/api/categorias/77');
    expect(res.status).toBe(404);
    expect(res.body.data.mensaje).toBe('Categoria no encontrada');
  });

  test('ERROR: id invalido -> 400', async () => {
    const res = await request(app).get('/api/categorias/trabajo');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 9. POST /api/categorias
// ---------------------------------------------------------------------------
describe('POST /api/categorias - crear categoria', () => {
  test('crea una categoria valida -> 201', async () => {
    const res = await request(app).post('/api/categorias').send({ nombre: 'Urgente' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: 4, nombre: 'Urgente' });
  });

  test('ERROR: falta el campo nombre -> 400', async () => {
    const res = await request(app).post('/api/categorias').send({});
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('El campo nombre es requerido');
  });

  test('ERROR: nombre vacio -> 400', async () => {
    const res = await request(app).post('/api/categorias').send({ nombre: '  ' });
    expect(res.status).toBe(400);
  });

  test('ERROR: nombre con tipo invalido -> 400', async () => {
    const res = await request(app).post('/api/categorias').send({ nombre: ['Urgente'] });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('El campo nombre debe ser texto');
  });

  test('ERROR: nombre de mas de 50 caracteres -> 400', async () => {
    const res = await request(app).post('/api/categorias').send({ nombre: 'a'.repeat(51) });
    expect(res.status).toBe(400);
  });

  test('ERROR: nombre duplicado -> 409 Conflict', async () => {
    const res = await request(app).post('/api/categorias').send({ nombre: 'Trabajo' });
    expect(res.status).toBe(409);
    expect(res.body.data.mensaje).toMatch(/Ya existe/);
  });

  test('ERROR: nombre duplicado con distinta mayuscula -> 409', async () => {
    const res = await request(app).post('/api/categorias').send({ nombre: 'TRABAJO' });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// 10. PUT /api/categorias/:id
// ---------------------------------------------------------------------------
describe('PUT /api/categorias/:id - actualizar categoria', () => {
  test('renombra una categoria -> 200', async () => {
    const res = await request(app).put('/api/categorias/2').send({ nombre: 'Hogar' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 2, nombre: 'Hogar' });
  });

  test('el nuevo nombre se refleja en las tareas (JOIN)', async () => {
    await request(app).post('/api/tareas').send({ titulo: 'Lavar', categoria_id: 2 });
    await request(app).put('/api/categorias/2').send({ nombre: 'Hogar' });
    const res = await request(app).get('/api/tareas/1');
    expect(res.body.data.categoria_nombre).toBe('Hogar');
  });

  test('permite "renombrar" con el mismo nombre que ya tiene', async () => {
    const res = await request(app).put('/api/categorias/1').send({ nombre: 'Trabajo' });
    expect(res.status).toBe(200);
  });

  test('ERROR: categoria que no existe -> 404', async () => {
    const res = await request(app).put('/api/categorias/99').send({ nombre: 'X' });
    expect(res.status).toBe(404);
  });

  test('ERROR: nombre ya usado por otra categoria -> 409', async () => {
    const res = await request(app).put('/api/categorias/2').send({ nombre: 'Estudio' });
    expect(res.status).toBe(409);
  });

  test('ERROR: falta el nombre -> 400', async () => {
    const res = await request(app).put('/api/categorias/1').send({});
    expect(res.status).toBe(400);
  });

  test('ERROR: id invalido -> 400', async () => {
    const res = await request(app).put('/api/categorias/0').send({ nombre: 'X' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 11. DELETE /api/categorias/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/categorias/:id - eliminar categoria', () => {
  test('elimina la categoria -> 200', async () => {
    const res = await request(app).delete('/api/categorias/3');
    expect(res.status).toBe(200);
    expect(res.body.data.mensaje).toBe('Categoria eliminada');
    const lista = await request(app).get('/api/categorias');
    expect(lista.body.data).toHaveLength(2);
  });

  test('las tareas de la categoria eliminada quedan sin categoria (ON DELETE SET NULL)', async () => {
    await request(app).post('/api/tareas').send({ titulo: 'Repasar', categoria_id: 3 });
    await request(app).delete('/api/categorias/3');
    const res = await request(app).get('/api/tareas/1');
    expect(res.status).toBe(200);
    expect(res.body.data.categoria_id).toBeNull();
    expect(res.body.data.categoria_nombre).toBeNull();
  });

  test('ERROR: categoria que no existe -> 404', async () => {
    const res = await request(app).delete('/api/categorias/42');
    expect(res.status).toBe(404);
  });

  test('ERROR: id invalido -> 400', async () => {
    const res = await request(app).delete('/api/categorias/-5');
    expect(res.status).toBe(400);
  });
});
