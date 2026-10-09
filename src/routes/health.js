const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { sendResponse } = require('../utils/response');
const { version } = require('../../package.json');

// GET /api/health - estado del servicio.
// Lo usan el HEALTHCHECK de Docker y el pipeline de CD para confirmar que la nueva
// version quedo arriba. 'commit' es el hash de Git con el que se construyo la imagen.
router.get('/', (req, res) => {
  let database = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch (err) {
    database = 'error';
  }

  const ok = database === 'ok';
  sendResponse(res, ok ? 200 : 503, {
    status: ok ? 'ok' : 'degraded',
    version,
    commit: process.env.GIT_SHA || 'local',
    database,
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
