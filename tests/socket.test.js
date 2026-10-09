const net = require('net');
const { initDb, resetDb } = require('../src/db/database');
const {
  parseComando,
  procesarMensaje,
  crearServidorSocket
} = require('../src/socketServer');

beforeAll(() => {
  initDb(); // este archivo no carga la app, asi que crea las tablas aqui
});

beforeEach(() => {
  resetDb();
});

// ---------------------------------------------------------------------------
// Pruebas unitarias del parser del protocolo
// ---------------------------------------------------------------------------
describe('parseComando - protocolo {insert:...} / {get:...}', () => {
  test('reconoce un comando insert con su JSON', () => {
    expect(parseComando('{insert:{"titulo":"A"}}')).toEqual({ comando: 'insert', contenido: '{"titulo":"A"}' });
  });

  test('reconoce un comando get con id', () => {
    expect(parseComando('{get:5}')).toEqual({ comando: 'get', contenido: '5' });
  });

  test('tolera espacios y salto de linea al final', () => {
    expect(parseComando('  {get:5}\r\n')).toEqual({ comando: 'get', contenido: '5' });
  });

  test.each(['hola', '{delete:1}', 'insert:{"titulo":"A"}', '{GET:1}', ''])(
    'ERROR: mensaje con formato invalido %p -> null',
    (msg) => {
      expect(parseComando(msg)).toBeNull();
    }
  );
});

// ---------------------------------------------------------------------------
// Pruebas de la logica de insert/get (sin red)
// ---------------------------------------------------------------------------
describe('procesarMensaje - insert', () => {
  test('inserta una tarea -> 201', () => {
    const r = procesarMensaje('{insert:{"titulo":"Prueba socket","categoria_id":1}}');
    expect(r.statusCode).toBe(201);
    expect(r.data).toMatchObject({ id: 1, titulo: 'Prueba socket', categoria_nombre: 'Trabajo' });
  });

  test('ERROR: JSON invalido -> 400', () => {
    const r = procesarMensaje('{insert:{titulo:A}}');
    expect(r).toEqual({ statusCode: 400, data: { mensaje: 'El elemento a insertar debe ser un JSON valido' } });
  });

  test('ERROR: {insert:null} -> 400 (antes tiraba el servidor completo)', () => {
    const r = procesarMensaje('{insert:null}');
    expect(r.statusCode).toBe(400);
    expect(r.data.mensaje).toBe('El elemento a insertar debe ser un objeto JSON');
  });

  test.each(['[1,2]', '"texto"', '123'])('ERROR: elemento que no es objeto (%s) -> 400', (el) => {
    expect(procesarMensaje(`{insert:${el}}`).statusCode).toBe(400);
  });

  test('ERROR: falta titulo -> 400', () => {
    expect(procesarMensaje('{insert:{"categoria_id":1}}').statusCode).toBe(400);
  });

  test('ERROR: categoria inexistente -> 400 (antes devolvia 500)', () => {
    const r = procesarMensaje('{insert:{"titulo":"A","categoria_id":999}}');
    expect(r.statusCode).toBe(400);
    expect(r.data.mensaje).toBe('La categoria 999 no existe');
  });
});

describe('procesarMensaje - get', () => {
  test('{get:} sin contenido devuelve todas las tareas', () => {
    procesarMensaje('{insert:{"titulo":"A"}}');
    procesarMensaje('{insert:{"titulo":"B"}}');
    const r = procesarMensaje('{get:}');
    expect(r.statusCode).toBe(200);
    expect(r.data).toHaveLength(2);
  });

  test('{get:1} devuelve la tarea con su categoria', () => {
    procesarMensaje('{insert:{"titulo":"A","categoria_id":2}}');
    const r = procesarMensaje('{get:1}');
    expect(r.statusCode).toBe(200);
    expect(r.data.categoria_nombre).toBe('Personal');
  });

  test('ERROR: id que no existe -> 404', () => {
    expect(procesarMensaje('{get:50}').statusCode).toBe(404);
  });

  test('ERROR: id no numerico -> 400 (antes devolvia todas las tareas)', () => {
    expect(procesarMensaje('{get:abc}').statusCode).toBe(400);
  });

  test('ERROR: formato invalido -> 400', () => {
    const r = procesarMensaje('dame las tareas');
    expect(r.statusCode).toBe(400);
    expect(r.data.mensaje).toMatch(/Formato invalido/);
  });
});

// ---------------------------------------------------------------------------
// Prueba de integracion: servidor TCP real en un puerto aleatorio
// ---------------------------------------------------------------------------
describe('Servidor TCP (conexion real)', () => {
  let server;
  let puerto;

  beforeAll((done) => {
    server = crearServidorSocket();
    server.listen(0, '127.0.0.1', () => {
      puerto = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  function enviar(mensaje) {
    return new Promise((resolve, reject) => {
      const cliente = net.createConnection({ port: puerto, host: '127.0.0.1' }, () => {
        cliente.write(mensaje);
      });
      cliente.on('data', (data) => {
        resolve(JSON.parse(data.toString()));
        cliente.end();
      });
      cliente.on('error', reject);
    });
  }

  test('insert y get por la red', async () => {
    const ins = await enviar('{insert:{"titulo":"Por TCP","categoria_id":1}}');
    expect(ins.statusCode).toBe(201);
    const get = await enviar(`{get:${ins.data.id}}`);
    expect(get.statusCode).toBe(200);
    expect(get.data.titulo).toBe('Por TCP');
  });

  test('el servidor sigue vivo despues de recibir {insert:null}', async () => {
    const malo = await enviar('{insert:null}');
    expect(malo.statusCode).toBe(400);
    const sano = await enviar('{get:}');
    expect(sano.statusCode).toBe(200);
  });
});
