const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/database');
const { sendResponse } = require('./utils/response');
const { version } = require('../package.json');

const tareasRouter = require('./routes/tareas');
const categoriasRouter = require('./routes/categorias');
const adminRouter = require('./routes/admin');
const healthRouter = require('./routes/health');

// Mensaje de bienvenida de la ruta raiz.
// Para la demostracion del pipeline basta con cambiar este texto, hacer git push
// y ver como el nuevo mensaje aparece en http://<IP_EC2>/ sin entrar al servidor.
const MENSAJE_BIENVENIDA = 'API de tareas desplegada automaticamente en AWS EC2 con Github Actions y Docker.';

// La app de Express se construye aqui y se exporta SIN llamar a listen().
// Asi las pruebas (Supertest) pueden usarla directamente sin abrir un puerto.
const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));

initDb();

// Ruta raiz
app.get('/', (req, res) => {
  sendResponse(res, 200, { mensaje: MENSAJE_BIENVENIDA, version });
});

app.use('/api/health', healthRouter);
app.use('/api/tareas', tareasRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api', adminRouter);

// Manejo de rutas no encontradas
app.use((req, res) => {
  sendResponse(res, 404, { mensaje: 'Ruta no encontrada' });
});

// Manejo de errores: JSON mal formado, body demasiado grande o errores inesperados.
// Siempre se responde con el schema normalizado { statusCode, data }.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return sendResponse(res, 400, { mensaje: 'El cuerpo de la peticion no es un JSON valido' });
  }
  if (err.type === 'entity.too.large') {
    return sendResponse(res, 413, { mensaje: 'El cuerpo de la peticion es demasiado grande' });
  }
  console.error(err);
  return sendResponse(res, 500, { mensaje: 'Error interno del servidor' });
});

module.exports = app;
