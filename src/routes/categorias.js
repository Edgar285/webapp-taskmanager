const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { sendResponse } = require('../utils/response');
const { NOMBRE_MAX, parseId, esObjetoPlano, validarTexto } = require('../utils/validators');

function nombreDuplicado(nombre, excluirId = 0) {
  return !!db.prepare('SELECT id FROM categorias WHERE lower(nombre) = lower(?) AND id <> ?')
    .get(nombre, excluirId);
}

// GET /api/categorias - listar todas
router.get('/', (req, res) => {
  sendResponse(res, 200, db.prepare('SELECT * FROM categorias').all());
});

// GET /api/categorias/:id - obtener una
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendResponse(res, 400, { mensaje: 'El id debe ser un entero positivo' });
  }
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  if (!categoria) {
    return sendResponse(res, 404, { mensaje: 'Categoria no encontrada' });
  }
  sendResponse(res, 200, categoria);
});

// POST /api/categorias - crear
router.post('/', (req, res) => {
  if (!esObjetoPlano(req.body)) {
    return sendResponse(res, 400, { mensaje: 'El cuerpo debe ser un objeto JSON' });
  }
  const { nombre } = req.body;
  const error = validarTexto(nombre, 'nombre', NOMBRE_MAX);
  if (error) return sendResponse(res, 400, { mensaje: error });

  if (nombreDuplicado(nombre.trim())) {
    return sendResponse(res, 409, { mensaje: `Ya existe una categoria llamada '${nombre.trim()}'` });
  }
  const info = db.prepare('INSERT INTO categorias (nombre) VALUES (?)').run(nombre.trim());
  const nueva = db.prepare('SELECT * FROM categorias WHERE id = ?').get(info.lastInsertRowid);
  sendResponse(res, 201, nueva);
});

// PUT /api/categorias/:id - actualizar el nombre
router.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendResponse(res, 400, { mensaje: 'El id debe ser un entero positivo' });
  }
  if (!esObjetoPlano(req.body)) {
    return sendResponse(res, 400, { mensaje: 'El cuerpo debe ser un objeto JSON' });
  }
  const existente = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  if (!existente) {
    return sendResponse(res, 404, { mensaje: 'Categoria no encontrada' });
  }
  const { nombre } = req.body;
  const error = validarTexto(nombre, 'nombre', NOMBRE_MAX);
  if (error) return sendResponse(res, 400, { mensaje: error });

  if (nombreDuplicado(nombre.trim(), id)) {
    return sendResponse(res, 409, { mensaje: `Ya existe una categoria llamada '${nombre.trim()}'` });
  }
  db.prepare('UPDATE categorias SET nombre = ? WHERE id = ?').run(nombre.trim(), id);
  sendResponse(res, 200, db.prepare('SELECT * FROM categorias WHERE id = ?').get(id));
});

// DELETE /api/categorias/:id - borrar (las tareas quedan sin categoria: ON DELETE SET NULL)
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendResponse(res, 400, { mensaje: 'El id debe ser un entero positivo' });
  }
  const info = db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
  if (info.changes === 0) {
    return sendResponse(res, 404, { mensaje: 'Categoria no encontrada' });
  }
  sendResponse(res, 200, { mensaje: 'Categoria eliminada' });
});

module.exports = router;
