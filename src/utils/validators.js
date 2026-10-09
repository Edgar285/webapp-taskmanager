// Funciones de validacion reutilizadas por la API REST y por el servidor TCP.

const TITULO_MAX = 200;
const NOMBRE_MAX = 50;

// Devuelve el id como numero si es un entero positivo, o null si no es valido.
function parseId(valor) {
  if (typeof valor === 'number') {
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  }
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 ? id : null;
}

function esObjetoPlano(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

// Valida un texto requerido (titulo o nombre). Devuelve un mensaje de error o null.
function validarTexto(valor, campo, max) {
  if (valor === undefined || valor === null) return `El campo ${campo} es requerido`;
  if (typeof valor !== 'string') return `El campo ${campo} debe ser texto`;
  if (valor.trim() === '') return `El campo ${campo} no puede estar vacio`;
  if (valor.length > max) return `El campo ${campo} no puede exceder ${max} caracteres`;
  return null;
}

// Acepta 0, 1, true o false. Devuelve 0/1 o undefined si no es valido.
function normalizarCompletada(valor) {
  if (valor === true || valor === 1) return 1;
  if (valor === false || valor === 0) return 0;
  return undefined;
}

module.exports = {
  TITULO_MAX,
  NOMBRE_MAX,
  parseId,
  esObjetoPlano,
  validarTexto,
  normalizarCompletada
};
