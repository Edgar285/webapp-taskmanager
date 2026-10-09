// Lee coverage/coverage-summary.json (generado por Jest) y muestra un resumen.
// En GitHub Actions ademas lo escribe en $GITHUB_STEP_SUMMARY para que aparezca
// como tabla en la pagina del pipeline.
const fs = require('fs');
const path = require('path');

const UMBRAL = 70;
const archivo = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

if (!fs.existsSync(archivo)) {
  console.log('No se encontro coverage/coverage-summary.json (las pruebas no generaron cobertura).');
  process.exit(0);
}

const { total } = JSON.parse(fs.readFileSync(archivo, 'utf-8'));
const metricas = [
  ['Statements', total.statements],
  ['Branches', total.branches],
  ['Functions', total.functions],
  ['Lines', total.lines]
];

const filas = metricas.map(([nombre, m]) => {
  const ok = m.pct >= UMBRAL;
  return { nombre, pct: m.pct, covered: m.covered, total: m.total, ok };
});

// Salida en los logs del pipeline
console.log(`\nResumen de cobertura (umbral minimo ${UMBRAL}%)`);
console.log('-------------------------------------------------');
filas.forEach((f) => {
  const estado = f.ok ? 'OK' : 'BAJO UMBRAL';
  console.log(`${f.nombre.padEnd(11)} ${String(f.pct.toFixed(2) + '%').padStart(8)}  (${f.covered}/${f.total})  ${estado}`);
});

// Tabla en el resumen del job de GitHub Actions
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `## Cobertura de codigo (umbral minimo ${UMBRAL}%)`,
    '',
    '| Metrica | Cobertura | Cubiertas / Total | Estado |',
    '|---|---:|---:|:---:|',
    ...filas.map((f) => `| ${f.nombre} | ${f.pct.toFixed(2)}% | ${f.covered} / ${f.total} | ${f.ok ? '✅' : '❌'} |`),
    ''
  ].join('\n');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}
