const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// La ruta de la base de datos se puede cambiar por variable de entorno.
// En las pruebas unitarias se usa DB_PATH=':memory:' para trabajar con una
// base de datos temporal en memoria y no tocar los datos reales.
const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'app.db');

if (DB_PATH !== ':memory:' && !fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const CATEGORIAS_INICIALES = ['Trabajo', 'Personal', 'Estudio'];

function seedCategorias() {
  const count = db.prepare('SELECT COUNT(*) as c FROM categorias').get().c;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
    CATEGORIAS_INICIALES.forEach((nombre) => insert.run(nombre));
  }
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      completada INTEGER NOT NULL DEFAULT 0,
      categoria_id INTEGER,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    );
  `);
  seedCategorias();
}

// Vacia las tablas y vuelve a cargar las categorias iniciales.
// Lo usan las pruebas para que cada prueba inicie con un estado conocido.
function resetDb() {
  db.exec('DELETE FROM tareas; DELETE FROM categorias; DELETE FROM sqlite_sequence;');
  seedCategorias();
}

module.exports = { db, initDb, resetDb, seedCategorias, DB_PATH, DB_DIR };
