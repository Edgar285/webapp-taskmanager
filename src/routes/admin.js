const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db, resetDb } = require('../db/database');
const { sendResponse } = require('../utils/response');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// GET /api/backup - respaldar la base de datos y descargar el archivo directamente.
// Se usa GET porque al pegar la URL en el navegador debe disparar la descarga del
// archivo de respaldo. El contenido del backup es JSON.
router.get('/backup', (req, res) => {
  try {
    const backupData = {
      generado_en: new Date().toISOString(),
      categorias: db.prepare('SELECT * FROM categorias').all(),
      tareas: db.prepare('SELECT * FROM tareas').all()
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

    res.download(backupPath, backupFileName, (err) => {
      if (err) console.error('Error al enviar el archivo de backup:', err.message);
    });
  } catch (err) {
    sendResponse(res, 500, { mensaje: 'Error al crear backup', error: err.message });
  }
});

// DELETE /api/reset - vaciar la base de datos.
// Por seguridad exige el header 'x-confirm-reset: true' para evitar borrados accidentales,
// y vuelve a cargar las categorias iniciales para que la API siga siendo utilizable.
router.delete('/reset', (req, res) => {
  if (req.get('x-confirm-reset') !== 'true') {
    return sendResponse(res, 400, {
      mensaje: "Operacion destructiva: envie el header 'x-confirm-reset: true' para confirmar"
    });
  }
  try {
    resetDb();
    sendResponse(res, 200, { mensaje: 'Base de datos vaciada correctamente' });
  } catch (err) {
    sendResponse(res, 500, { mensaje: 'Error al vaciar la base de datos', error: err.message });
  }
});

module.exports = router;
