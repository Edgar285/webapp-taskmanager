// Se ejecuta antes de cada archivo de pruebas.
// Usa una base de datos SQLite en memoria y una carpeta temporal para los backups,
// de modo que las pruebas nunca modifican los datos reales de la aplicacion.
const os = require('os');
const path = require('path');

process.env.DB_PATH = ':memory:';
process.env.BACKUP_DIR = path.join(os.tmpdir(), 'webapp-taskmanager-test-backups');
