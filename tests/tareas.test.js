const request = require('supertest');
const app = require('../src/app');
const { resetDb } = require('../src/db/database');

// Helper: crea una tarea por la API y devuelve el objeto creado
async function crearTarea(body = { titulo: 'Tarea de prueba', categoria_id: 1 }) {
  const res = await request(app).post('/api/tareas').send(body);
  return res.body.data;
}

beforeEach(() => {
  resetDb(); // cada prueba inicia con BD vacia + 3 categorias (Trabajo, Personal, Estudio)
});

// ---------------------------------------------------------------------------
// 1. GET /api/tareas
// ---------------------------------------------------------------------------
describe('GET /api/tareas - listar tareas', () => {
  test('devuelve 200 y una lista vacia cuando no hay tareas', async () => {
    const res = await request(app).get('/api/tareas');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ statusCode: 200, data: [] });
  });

  test('devuelve las tareas con el nombre de su categoria (JOIN)', async () => {
    await crearTarea({ titulo: 'Estudiar Jest', categoria_id: 3 });
    const res = await request(app).get('/api/tareas');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ titulo: 'Estudiar Jest', categoria_nombre: 'Estudio' });
  });

  test('filtra por ?completada=1', async () => {
    const t = await crearTarea({ titulo: 'A' });
    await crearTarea({ titulo: 'B' });
    await request(app).patch(`/api/tareas/${t.id}/completar`);
    const res = await request(app).get('/api/tareas?completada=1');
    expect(res.status).toBe(200);
    expect(res.body.data.map((x) => x.titulo)).toEqual(['A']);
  });

  test('ERROR: filtro ?completada con valor invalido -> 400', async () => {
    const res = await request(app).get('/api/tareas?completada=si');
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toMatch(/0 o 1/);
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/tareas/:id
// ---------------------------------------------------------------------------
describe('GET /api/tareas/:id - obtener una tarea', () => {
  test('devuelve 200 con la tarea solicitada', async () => {
    const t = await crearTarea();
    const res = await request(app).get(`/api/tareas/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: t.id, titulo: 'Tarea de prueba', categoria_nombre: 'Trabajo' });
  });

  test('ERROR: id que no existe -> 404', async () => {
    const res = await request(app).get('/api/tareas/9999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ statusCode: 404, data: { mensaje: 'Tarea no encontrada' } });
  });

  test.each(['abc', '-1', '0', '1.5'])('ERROR: id invalido "%s" -> 400', async (id) => {
    const res = await request(app).get(`/api/tareas/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('El id debe ser un entero positivo');
  });
});

// ---------------------------------------------------------------------------
// 3. POST /api/tareas
// ---------------------------------------------------------------------------
describe('POST /api/tareas - crear tarea', () => {
  test('crea una tarea valida -> 201', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'Nueva tarea', categoria_id: 2 });
    expect(res.status).toBe(201);
    expect(res.body.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({
      id: 1, titulo: 'Nueva tarea', completada: 0, categoria_id: 2, categoria_nombre: 'Personal'
    });
  });

  test('crea una tarea sin categoria (categoria_id es opcional)', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'Sin categoria' });
    expect(res.status).toBe(201);
    expect(res.body.data.categoria_id).toBeNull();
  });

  test('elimina espacios sobrantes del titulo', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: '   Con espacios   ' });
    expect(res.body.data.titulo).toBe('Con espacios');
  });

  test('ERROR: falta el campo titulo -> 400', async () => {
    const res = await request(app).post('/api/tareas').send({ categoria_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('El campo titulo es requerido');
  });

  test('ERROR: titulo vacio o solo espacios -> 400', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: '    ' });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('El campo titulo no puede estar vacio');
  });

  test('ERROR: titulo que no es texto -> 400', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 12345 });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('El campo titulo debe ser texto');
  });

  test('ERROR: titulo de mas de 200 caracteres -> 400', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'x'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toMatch(/200 caracteres/);
  });

  test('ERROR: categoria_id que no existe -> 400', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'X', categoria_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('La categoria 999 no existe');
  });

  test('ERROR: categoria_id con tipo invalido -> 400', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'X', categoria_id: 'uno' });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toMatch(/entero positivo/);
  });

  test('ERROR: JSON mal formado -> 400 con el schema normalizado', async () => {
    const res = await request(app)
      .post('/api/tareas')
      .set('Content-Type', 'application/json')
      .send('{"titulo": "sin cerrar"');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      statusCode: 400,
      data: { mensaje: 'El cuerpo de la peticion no es un JSON valido' }
    });
  });

  test('ERROR: body como arreglo en lugar de objeto -> 400', async () => {
    const res = await request(app).post('/api/tareas').send([{ titulo: 'X' }]);
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toBe('El cuerpo debe ser un objeto JSON');
  });

  test('ERROR: body vacio -> 400', async () => {
    const res = await request(app).post('/api/tareas');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 4. PUT /api/tareas/:id
// ---------------------------------------------------------------------------
describe('PUT /api/tareas/:id - actualizar tarea', () => {
  test('actualiza el campo completada de 0 a 1', async () => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({ completada: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.completada).toBe(1);
    expect(res.body.data.titulo).toBe('Tarea de prueba'); // lo demas no cambia
  });

  test('acepta completada como booleano (true/false)', async () => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({ completada: true });
    expect(res.body.data.completada).toBe(1);
  });

  test('actualiza titulo y categoria al mismo tiempo', async () => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({ titulo: 'Editada', categoria_id: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ titulo: 'Editada', categoria_id: 3, categoria_nombre: 'Estudio' });
  });

  test('categoria_id: null quita la categoria de la tarea', async () => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({ categoria_id: null });
    expect(res.status).toBe(200);
    expect(res.body.data.categoria_id).toBeNull();
  });

  test('ERROR: tarea que no existe -> 404', async () => {
    const res = await request(app).put('/api/tareas/9999').send({ completada: 1 });
    expect(res.status).toBe(404);
  });

  test('ERROR: id invalido -> 400', async () => {
    const res = await request(app).put('/api/tareas/abc').send({ completada: 1 });
    expect(res.status).toBe(400);
  });

  test('ERROR: body sin ningun campo a actualizar -> 400', async () => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toMatch(/al menos un campo/);
  });

  test.each([2, 'si', -1, 'true'])('ERROR: completada con valor invalido (%p) -> 400', async (valor) => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({ completada: valor });
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toMatch(/completada/);
  });

  test('ERROR: titulo vacio -> 400 y la tarea NO se modifica', async () => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({ titulo: '' });
    expect(res.status).toBe(400);
    const check = await request(app).get(`/api/tareas/${t.id}`);
    expect(check.body.data.titulo).toBe('Tarea de prueba');
  });

  test('ERROR: categoria inexistente -> 400', async () => {
    const t = await crearTarea();
    const res = await request(app).put(`/api/tareas/${t.id}`).send({ categoria_id: 50 });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 5. PATCH /api/tareas/:id/completar
// ---------------------------------------------------------------------------
describe('PATCH /api/tareas/:id/completar - marcar como completada', () => {
  test('marca la tarea como completada -> 200', async () => {
    const t = await crearTarea();
    const res = await request(app).patch(`/api/tareas/${t.id}/completar`);
    expect(res.status).toBe(200);
    expect(res.body.data.completada).toBe(1);
  });

  test('ERROR: completar una tarea ya completada -> 409', async () => {
    const t = await crearTarea();
    await request(app).patch(`/api/tareas/${t.id}/completar`);
    const res = await request(app).patch(`/api/tareas/${t.id}/completar`);
    expect(res.status).toBe(409);
    expect(res.body.data.mensaje).toBe('La tarea ya estaba completada');
  });

  test('ERROR: tarea que no existe -> 404', async () => {
    const res = await request(app).patch('/api/tareas/123/completar');
    expect(res.status).toBe(404);
  });

  test('ERROR: id invalido -> 400', async () => {
    const res = await request(app).patch('/api/tareas/xyz/completar');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 6. DELETE /api/tareas/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/tareas/:id - eliminar tarea', () => {
  test('elimina la tarea -> 200 y ya no se puede consultar', async () => {
    const t = await crearTarea();
    const res = await request(app).delete(`/api/tareas/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.mensaje).toBe('Tarea eliminada');

    const check = await request(app).get(`/api/tareas/${t.id}`);
    expect(check.status).toBe(404);
  });

  test('ERROR: eliminar dos veces la misma tarea -> 404 la segunda vez', async () => {
    const t = await crearTarea();
    await request(app).delete(`/api/tareas/${t.id}`);
    const res = await request(app).delete(`/api/tareas/${t.id}`);
    expect(res.status).toBe(404);
  });

  test('ERROR: id invalido -> 400', async () => {
    const res = await request(app).delete('/api/tareas/uno');
    expect(res.status).toBe(400);
  });

  test('ERROR: DELETE sin id (/api/tareas) -> 404 ruta no encontrada', async () => {
    const res = await request(app).delete('/api/tareas');
    expect(res.status).toBe(404);
    expect(res.body.data.mensaje).toBe('Ruta no encontrada');
  });
});
