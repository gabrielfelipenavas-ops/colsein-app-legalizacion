'use strict';
// ── Archivos subidos con copia permanente en la base de datos ──
//
// Problema que resuelve: en Railway el disco del servidor es EFÍMERO. Cada
// redespliegue arranca con un disco vacío y las fotos de las facturas, los
// soportes de kilometraje y las firmas guardadas en UPLOAD_DIR desaparecían.
// El PDF/Excel de la legalización quedaba con "Imagen no disponible en el
// servidor" y el visor de soportes en blanco.
//
// Solución: cada archivo subido se guarda en el disco (rápido de servir) Y en
// la tabla `archivos` de PostgreSQL (permanente). Cuando alguien pide un
// archivo que no está en el disco, se restaura desde la base de datos y se
// vuelve a dejar en el disco. Así las fotos sobreviven a los despliegues sin
// necesidad de configurar nada en Railway.
//
// Las rutas se manejan siempre RELATIVAS a UPLOAD_DIR ("2026-10/uuid.jpg"),
// que es lo que va después de "/uploads/" en imagen_url / *_foto / firma_url.
const fs = require('fs');
const path = require('path');
const db = require('../models');

const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || './uploads');

const MIME_POR_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.heic': 'image/heic', '.heif': 'image/heif', '.pdf': 'application/pdf',
};

// "/uploads/2026-10/a.jpg" → "2026-10/a.jpg". Devuelve null si la URL no es de
// uploads o intenta salirse del directorio (path traversal).
function relDesdeUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const rel = url.slice('/uploads/'.length).replace(/\\/g, '/').split('?')[0];
  return relSegura(rel);
}

function relSegura(rel) {
  if (!rel) return null;
  let decoded = rel;
  try { decoded = decodeURIComponent(rel); } catch { /* se deja tal cual */ }
  const abs = path.resolve(uploadDir(), decoded);
  if (!abs.startsWith(uploadDir() + path.sep)) return null;
  return path.relative(uploadDir(), abs).replace(/\\/g, '/');
}

// Acepta cualquier forma de nombrar un archivo (URL "/uploads/…", ruta en
// disco absoluta o relativa al proyecto como la que entrega multer, o ruta
// relativa a UPLOAD_DIR) y devuelve la ruta relativa a UPLOAD_DIR.
function aRel(p) {
  if (!p || typeof p !== 'string') return null;
  if (p.startsWith('/uploads/')) return relDesdeUrl(p);
  const abs = path.resolve(p);
  if (abs.startsWith(uploadDir() + path.sep) && fs.existsSync(abs)) return relDesdeAbsoluta(abs);
  return relSegura(p);
}

// Ruta absoluta en disco de un archivo relativo a UPLOAD_DIR
function rutaAbsoluta(rel) {
  const r = relSegura(rel);
  return r ? path.join(uploadDir(), r) : null;
}

// Convierte una ruta absoluta de disco en la relativa a UPLOAD_DIR
function relDesdeAbsoluta(abs) {
  return relSegura(path.relative(uploadDir(), path.resolve(abs)).replace(/\\/g, '/'));
}

// Guarda (o actualiza) en la base de datos la copia permanente de un archivo
// que ya está en el disco. Nunca lanza: si la BD falla, el archivo sigue en
// disco y se registra el error en consola.
async function guardar(absOrRel) {
  const rel = aRel(absOrRel);
  if (!rel) return null;
  const abs = path.join(uploadDir(), rel);
  try {
    const contenido = fs.readFileSync(abs);
    const mime = MIME_POR_EXT[path.extname(rel).toLowerCase()] || 'application/octet-stream';
    const [row] = await db.Archivo.upsert({ ruta: rel, mime, tamano: contenido.length, contenido }, { returning: true });
    return row || true;
  } catch (err) {
    console.error(`[archivos] No se pudo guardar la copia permanente de ${rel}:`, err.message);
    return null;
  }
}

// Se asegura de que el archivo exista en el disco: si no está, lo restaura
// desde la base de datos. Devuelve la ruta absoluta o null si no existe en
// ninguna parte. Acepta ruta relativa o la URL completa "/uploads/...".
async function asegurar(relOUrl) {
  const rel = aRel(relOUrl);
  if (!rel) return null;
  const abs = path.join(uploadDir(), rel);
  if (fs.existsSync(abs)) return abs;
  try {
    const row = await db.Archivo.findOne({ where: { ruta: rel } });
    if (!row) return null;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, row.contenido);
    return abs;
  } catch (err) {
    console.error(`[archivos] No se pudo restaurar ${rel} desde la base de datos:`, err.message);
    return null;
  }
}

// Borra el archivo del disco y de la base de datos
async function eliminar(relOUrl) {
  const rel = aRel(relOUrl);
  if (!rel) return;
  try { fs.unlinkSync(path.join(uploadDir(), rel)); } catch { /* ya no estaba */ }
  try { await db.Archivo.destroy({ where: { ruta: rel } }); } catch (err) {
    console.error(`[archivos] No se pudo borrar ${rel} de la base de datos:`, err.message);
  }
}

// Al arrancar: guarda en la base de datos los archivos que estén en el disco
// y aún no tengan copia (p. ej. subidos antes de esta mejora, o si se usa un
// volumen). Corre en segundo plano y no bloquea el arranque.
async function respaldarDirectorio() {
  const base = uploadDir();
  if (!fs.existsSync(base)) return { revisados: 0, guardados: 0 };
  let revisados = 0, guardados = 0;
  const existentes = new Set((await db.Archivo.findAll({ attributes: ['ruta'], raw: true })).map(r => r.ruta));
  const recorrer = async (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) { await recorrer(abs); continue; }
      if (!ent.isFile()) continue;
      revisados++;
      const rel = relDesdeAbsoluta(abs);
      if (!rel || existentes.has(rel)) continue;
      // Solo tipos que la app sube (evita respaldar temporales como *_ocr.png)
      if (!MIME_POR_EXT[path.extname(rel).toLowerCase()]) continue;
      if (/_ocr\.png$/i.test(rel)) continue;
      if (await guardar(abs)) guardados++;
    }
  };
  await recorrer(base);
  return { revisados, guardados };
}

module.exports = { aRel, relDesdeUrl, rutaAbsoluta, relDesdeAbsoluta, guardar, asegurar, eliminar, respaldarDirectorio, uploadDir };
