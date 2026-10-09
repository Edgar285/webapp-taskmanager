const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { sendResponse } = require('../utils/response');
const {
  TITULO_MAX,
  parseId,
  esObjetoPlano,
  validarTexto,
  normalizarCompletada
} = require('../utils/validators');

const SELECT_TAREA = `
  SELECT t.id, t.titulo, t.completada, t.categoria_id, t.creado_en, c.nombre AS categoria_nombre
  FROM tareas t
  LEFT JOIN categorias c ON t.categoria_id = c.id
`;

function obtenerTarea(id) {
  return db.prepare(`${SELECT_TAREA} WHERE t.id = ?`).get(id);
}

function categoriaExiste(id) {
  return !!db.prepare('SELECT id FROM categorias WHERE id = ?').get(id);
}

// Valida categoria_id. Devuelve { error } o { valor } (null = sin categoria).
function validarCategoriaId(valor) {
  if (valor === undefined || valor === null) return { valor: null };
  const id = parseId(valor);
  if (id === null) return { error: 'El campo categoria_id debe ser un entero positivo' };
  if (!categoriaExiste(id)) return { error: `La categoria ${id} no existe` };
  return { valor: id };
}

// GET /api/tareas - listar todas (con nombre de categoria, normalizado via JOIN)
// Filtro opcional: ?completada=0 o ?completada=1
router.get('/', (req, res) => {
  const { completada } = req.query;
  if (completada !== undefined) {
    if (completada !== '0' && completada !== '1') {
      return sendResponse(res, 400, { mensaje: 'El filtro completada solo acepta 0 o 1' });
    }
    const tareas = db.prepare(`${SELECT_TAREA} WHERE t.completada = ?`).all(Number(completada));
    return sendResponse(res, 200, tareas);
  }
  sendResponse(res, 200, db.prepare(SELECT_TAREA).all());
});

// GET /api/tareas/:id - obtener una
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendResponse(res, 400, { mensaje: 'El id debe ser un entero positivo' });
  }
  const tarea = obtenerTarea(id);
  if (!tarea) {
    return sendResponse(res, 404, { mensaje: 'Tarea no encontrada' });
  }
  sendResponse(res, 200, tarea);
});

// POST /api/tareas - crear
router.post('/', (req, res) => {
  if (!esObjetoPlano(req.body)) {
    return sendResponse(res, 400, { mensaje: 'El cuerpo debe ser un objeto JSON' });
  }
  const { titulo, categoria_id } = req.body;

  const errorTitulo = validarTexto(titulo, 'titulo', TITULO_MAX);
  if (errorTitulo) return sendResponse(res, 400, { mensaje: errorTitulo });

  const categoria = validarCategoriaId(categoria_id);
  if (categoria.error) return sendResponse(res, 400, { mensaje: categoria.error });

  const info = db.prepare('INSERT INTO tareas (titulo, categoria_id) VALUES (?, ?)')
    .run(titulo.trim(), categoria.valor);
  sendResponse(res, 201, obtenerTarea(info.lastInsertRowid));
});

// PUT /api/tareas/:id - actualizar (titulo, completada y/o categoria_id)
router.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendResponse(res, 400, { mensaje: 'El id debe ser un entero positivo' });
  }
  if (!esObjetoPlano(req.body)) {
    return sendResponse(res, 400, { mensaje: 'El cuerpo debe ser un objeto JSON' });
  }

  const existente = db.prepare('SELECT * FROM tareas WHERE id = ?').get(id);
  if (!existente) {
    return sendResponse(res, 404, { mensaje: 'Tarea no encontrada' });
  }

  const { titulo, completada, categoria_id } = req.body;
  if (titulo === undefined && completada === undefined && categoria_id === undefined) {
    return sendResponse(res, 400, {
      mensaje: 'Debe enviar al menos un campo a actualizar: titulo, completada o categoria_id'
    });
  }

  let nuevoTitulo = existente.titulo;
  if (titulo !== undefined) {
    const errorTitulo = validarTexto(titulo, 'titulo', TITULO_MAX);
    if (errorTitulo) return sendResponse(res, 400, { mensaje: errorTitulo });
    nuevoTitulo = titulo.trim();
  }

  let nuevaCompletada = existente.completada;
  if (completada !== undefined) {
    nuevaCompletada = normalizarCompletada(completada);
    if (nuevaCompletada === undefined) {
      return sendResponse(res, 400, { mensaje: 'El campo completada solo acepta 0, 1, true o false' });
    }
  }

  // categoria_id: null permite quitar la categoria de la tarea
  let nuevaCategoria = existente.categoria_id;
  if (categoria_id !== undefined) {
    const categoria = validarCategoriaId(categoria_id);
    if (categoria.error) return sendResponse(res, 400, { mensaje: categoria.error });
    nuevaCategoria = categoria.valor;
  }

  db.prepare('UPDATE tareas SET titulo = ?, completada = ?, categoria_id = ? WHERE id = ?')
    .run(nuevoTitulo, nuevaCompletada, nuevaCategoria, id);
  sendResponse(res, 200, obtenerTarea(id));
});

// PATCH /api/tareas/:id/completar - marcar una tarea como completada
router.patch('/:id/completar', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendResponse(res, 400, { mensaje: 'El id debe ser un entero positivo' });
  }
  const existente = obtenerTarea(id);
  if (!existente) {
    return sendResponse(res, 404, { mensaje: 'Tarea no encontrada' });
  }
  if (existente.completada === 1) {
    return sendResponse(res, 409, { mensaje: 'La tarea ya estaba completada' });
  }
  db.prepare('UPDATE tareas SET completada = 1 WHERE id = ?').run(id);
  sendResponse(res, 200, obtenerTarea(id));
});

// DELETE /api/tareas/:id - borrar
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendResponse(res, 400, { mensaje: 'El id debe ser un entero positivo' });
  }
  const info = db.prepare('DELETE FROM tareas WHERE id = ?').run(id);
  if (info.changes === 0) {
    return sendResponse(res, 404, { mensaje: 'Tarea no encontrada' });
  }
  sendResponse(res, 200, { mensaje: 'Tarea eliminada' });
});

module.exports = router;
