const fs = require('fs');
const request = require('supertest');
const app = require('../src/app');
const { resetDb } = require('../src/db/database');

beforeEach(() => {
  resetDb();
});

// ---------------------------------------------------------------------------
// 12. GET /api/backup
// ---------------------------------------------------------------------------
describe('GET /api/backup - respaldo de la base de datos', () => {
  test('descarga un archivo JSON con categorias y tareas', async () => {
    await request(app).post('/api/tareas').send({ titulo: 'Respaldar esto', categoria_id: 1 });

    const res = await request(app).get('/api/backup').buffer(true).parse((r, cb) => {
      let data = '';
      r.on('data', (chunk) => { data += chunk; });
      r.on('end', () => cb(null, data));
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="backup-.*\.json"/);

    const backup = JSON.parse(res.body);
    expect(backup).toHaveProperty('generado_en');
    expect(backup.categorias).toHaveLength(3);
    expect(backup.tareas).toHaveLength(1);
    expect(backup.tareas[0].titulo).toBe('Respaldar esto');
  });

  test('el archivo de respaldo queda guardado en la carpeta de backups', async () => {
    const antes = fs.readdirSync(process.env.BACKUP_DIR).length;
    await request(app).get('/api/backup');
    const despues = fs.readdirSync(process.env.BACKUP_DIR).length;
    expect(despues).toBe(antes + 1);
  });

  test('ERROR: usar POST en lugar de GET -> 404', async () => {
    const res = await request(app).post('/api/backup');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 13. DELETE /api/reset
// ---------------------------------------------------------------------------
describe('DELETE /api/reset - vaciar la base de datos', () => {
  test('con confirmacion: vacia las tareas y restaura las categorias iniciales', async () => {
    await request(app).post('/api/tareas').send({ titulo: 'A' });
    await request(app).post('/api/categorias').send({ nombre: 'Extra' });

    const res = await request(app).delete('/api/reset').set('x-confirm-reset', 'true');
    expect(res.status).toBe(200);
    expect(res.body.data.mensaje).toBe('Base de datos vaciada correctamente');

    const tareas = await request(app).get('/api/tareas');
    expect(tareas.body.data).toEqual([]);
    const categorias = await request(app).get('/api/categorias');
    expect(categorias.body.data.map((c) => c.nombre)).toEqual(['Trabajo', 'Personal', 'Estudio']);
  });

  test('despues del reset se puede seguir creando tareas con categoria 1', async () => {
    await request(app).delete('/api/reset').set('x-confirm-reset', 'true');
    const res = await request(app).post('/api/tareas').send({ titulo: 'Post-reset', categoria_id: 1 });
    expect(res.status).toBe(201);
  });

  test('ERROR: sin el header de confirmacion -> 400 y NO borra nada', async () => {
    await request(app).post('/api/tareas').send({ titulo: 'No me borres' });
    const res = await request(app).delete('/api/reset');
    expect(res.status).toBe(400);
    expect(res.body.data.mensaje).toMatch(/x-confirm-reset/);

    const tareas = await request(app).get('/api/tareas');
    expect(tareas.body.data).toHaveLength(1);
  });

  test('ERROR: header de confirmacion con valor incorrecto -> 400', async () => {
    const res = await request(app).delete('/api/reset').set('x-confirm-reset', 'yes');
    expect(res.status).toBe(400);
  });
});
