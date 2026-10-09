const net = require('net');
const { db } = require('./db/database');
const { TITULO_MAX, parseId, esObjetoPlano, validarTexto } = require('./utils/validators');

const SOCKET_PORT = process.env.SOCKET_PORT || 6061;

// En pruebas (Jest define NODE_ENV=test) no se imprimen logs de conexion
const log = process.env.NODE_ENV === 'test' ? () => {} : console.log;

const SELECT_TAREA = `
  SELECT t.id, t.titulo, t.completada, t.categoria_id, t.creado_en, c.nombre AS categoria_nombre
  FROM tareas t
  LEFT JOIN categorias c ON t.categoria_id = c.id
`;

// Extrae el comando y su contenido de mensajes con formato {insert:<element>} o {get:<element>}
function parseComando(mensaje) {
  if (typeof mensaje !== 'string') return null;
  const texto = mensaje.trim();

  const matchInsert = texto.match(/^\{insert:([\s\S]*)\}$/);
  if (matchInsert) return { comando: 'insert', contenido: matchInsert[1].trim() };

  const matchGet = texto.match(/^\{get:([\s\S]*)\}$/);
  if (matchGet) return { comando: 'get', contenido: matchGet[1].trim() };

  return null;
}

function manejarInsert(contenido) {
  let body;
  try {
    body = JSON.parse(contenido);
  } catch (err) {
    return { statusCode: 400, data: { mensaje: 'El elemento a insertar debe ser un JSON valido' } };
  }

  // Antes de la v4, {insert:null} tiraba el proceso completo (TypeError al desestructurar null)
  if (!esObjetoPlano(body)) {
    return { statusCode: 400, data: { mensaje: 'El elemento a insertar debe ser un objeto JSON' } };
  }

  const { titulo, categoria_id } = body;
  const errorTitulo = validarTexto(titulo, 'titulo', TITULO_MAX);
  if (errorTitulo) return { statusCode: 400, data: { mensaje: errorTitulo } };

  let categoria = null;
  if (categoria_id !== undefined && categoria_id !== null) {
    categoria = parseId(categoria_id);
    if (categoria === null) {
      return { statusCode: 400, data: { mensaje: 'El campo categoria_id debe ser un entero positivo' } };
    }
    if (!db.prepare('SELECT id FROM categorias WHERE id = ?').get(categoria)) {
      return { statusCode: 400, data: { mensaje: `La categoria ${categoria} no existe` } };
    }
  }

  const info = db.prepare('INSERT INTO tareas (titulo, categoria_id) VALUES (?, ?)')
    .run(titulo.trim(), categoria);
  const nueva = db.prepare(`${SELECT_TAREA} WHERE t.id = ?`).get(info.lastInsertRowid);
  return { statusCode: 201, data: nueva };
}

function manejarGet(contenido) {
  // {get:} sin contenido devuelve todas las tareas
  if (contenido === '') {
    return { statusCode: 200, data: db.prepare(SELECT_TAREA).all() };
  }

  const id = parseId(contenido);
  if (id === null) {
    return { statusCode: 400, data: { mensaje: 'El id debe ser un entero positivo o vacio para obtener todas' } };
  }

  const tarea = db.prepare(`${SELECT_TAREA} WHERE t.id = ?`).get(id);
  if (!tarea) return { statusCode: 404, data: { mensaje: 'Elemento no encontrado' } };
  return { statusCode: 200, data: tarea };
}

// Procesa un mensaje completo y siempre devuelve una respuesta normalizada (nunca lanza error)
function procesarMensaje(mensaje) {
  try {
    const comando = parseComando(mensaje);
    if (!comando) {
      return {
        statusCode: 400,
        data: { mensaje: 'Formato invalido. Use {insert:<element>} o {get:<element>}' }
      };
    }
    return comando.comando === 'insert'
      ? manejarInsert(comando.contenido)
      : manejarGet(comando.contenido);
  } catch (err) {
    console.error('Error procesando mensaje TCP:', err.message);
    return { statusCode: 500, data: { mensaje: 'Error interno del servidor' } };
  }
}

function crearServidorSocket() {
  return net.createServer((socket) => {
    log('Cliente conectado al socket TCP:', socket.remoteAddress, socket.remotePort);

    socket.on('data', (data) => {
      const resultado = procesarMensaje(data.toString());
      socket.write(JSON.stringify(resultado) + '\n');
    });

    socket.on('end', () => log('Cliente desconectado del socket TCP'));
    socket.on('error', (err) => console.error('Error en socket TCP:', err.message));
  });
}

function iniciarServidorSocket(puerto = SOCKET_PORT) {
  const server = crearServidorSocket();
  server.listen(puerto, '0.0.0.0', () => {
    log(`Servidor de sockets TCP escuchando en el puerto ${puerto}`);
  });
  return server;
}

module.exports = {
  iniciarServidorSocket,
  crearServidorSocket,
  procesarMensaje,
  parseComando,
  manejarInsert,
  manejarGet
};
