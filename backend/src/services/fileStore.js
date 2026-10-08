const fs = require('fs');
const path = require('path');
const db = require('../models');

// ── Almacén de archivos subidos (facturas, fotos de soporte, firmas) ──
//
// Problema: en Railway el disco del servidor es EFÍMERO. Cada redespliegue o
// reinicio borra la carpeta de uploads, así que las facturas "se perdían": la
// base de datos seguía apuntando a /uploads/2026-10/xxx.jpg pero el archivo ya
// no existía (imagen rota en la app y ZIP de facturas vacío).
//
// Solución: cada archivo subido se guarda en el disco (rápido de servir) Y en
// la base de datos (tabla stored_files, que sí es persistente). Cuando el
// disco no tiene el archivo (contenedor nuevo), se restaura desde la base de
// datos de forma transparente: al servir /uploads/..., al armar el ZIP de
// facturas, el Excel con soportes o el PDF con la firma.

const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || './uploads');

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.heic': 'image/heic', '.heif': 'image/heif',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.zip': 'application/zip',
};
const mimeOf = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

// Ruta relativa (posix) dentro de UPLOAD_DIR, o null si está fuera (path traversal)
function relOf(absPath) {
  const rel = path.relative(uploadDir(), path.resolve(absPath)).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel;
}

// Acepta una URL "/uploads/2026-10/x.jpg", una ruta relativa "2026-10/x.jpg" o
// una ruta absoluta, y devuelve { abs, rel } dentro de UPLOAD_DIR (o null).
function resolveRef(ref) {
  if (!ref || typeof ref !== 'string') return null;
  let abs;
  if (ref.startsWith('/uploads/')) abs = path.resolve(uploadDir(), decodeURIComponent(ref.slice('/uploads/'.length)));
  else if (path.isAbsolute(ref)) abs = path.resolve(ref);
  else abs = path.resolve(uploadDir(), ref);
  const rel = relOf(abs);
  return rel ? { abs, rel } : null;
}

// Guarda (o actualiza) en la base de datos el archivo que está en disco.
async function persistFile(absPath, mime) {
  const ref = resolveRef(absPath);
  if (!ref || !fs.existsSync(ref.abs)) return false;
  const data = fs.readFileSync(ref.abs);
  await db.StoredFile.upsert({ path: ref.rel, mime: mime || mimeOf(ref.abs), size: data.length, data });
  return true;
}

// Escribe en disco el archivo guardado en la base de datos. Devuelve la ruta
// absoluta si se pudo restaurar, o null si no existe en la base de datos.
async function restoreFile(ref) {
  const r = resolveRef(ref);
  if (!r) return null;
  const stored = await db.StoredFile.findByPk(r.rel);
  if (!stored) return null;
  fs.mkdirSync(path.dirname(r.abs), { recursive: true });
  fs.writeFileSync(r.abs, stored.data);
  return r.abs;
}

// Ruta absoluta de un archivo listo para leer: si está en disco se usa, si no
// se restaura desde la base de datos. null si no existe en ningún lado.
async function ensureLocal(ref) {
  const r = resolveRef(ref);
  if (!r) return null;
  if (fs.existsSync(r.abs)) return r.abs;
  try { return await restoreFile(r.rel); } catch (err) {
    console.warn('[fileStore] No se pudo restaurar', r.rel, err.message);
    return null;
  }
}

// Borra el archivo del disco y de la base de datos.
async function removeFile(ref) {
  const r = resolveRef(ref);
  if (!r) return;
  try { fs.unlinkSync(r.abs); } catch {}
  try { await db.StoredFile.destroy({ where: { path: r.rel } }); } catch {}
}

// Los teléfonos suben HEIC/HEIF (iPhone), que el navegador no muestra: se
// convierte a JPG en el mismo sitio y se actualiza req.file.
async function normalizeHeic(file) {
  if (!file) return file;
  const name = (file.originalname || '').toLowerCase();
  const mt = (file.mimetype || '').toLowerCase();
  const isHeic = /\.(heic|heif)$/.test(name) || mt === 'image/heic' || mt === 'image/heif' || /\.(heic|heif)$/i.test(file.path || '');
  if (!isHeic) return file;
  try {
    const sharp = require('sharp');
    const newPath = file.path.replace(/\.(heic|heif)$/i, '.jpg');
    await sharp(file.path).rotate().jpeg({ quality: 88 }).toFile(newPath);
    try { fs.unlinkSync(file.path); } catch {}
    file.path = newPath;
    file.filename = path.basename(newPath);
    file.mimetype = 'image/jpeg';
    file.originalname = file.originalname.replace(/\.(heic|heif)$/i, '.jpg');
  } catch (err) {
    console.warn('[fileStore] Conversión HEIC falló, se deja el original:', err.message);
  }
  return file;
}

// Reduce las fotos de celular (10–15 MB) a un tamaño razonable para guardarlas
// en la base de datos y descargarlas rápido, sin perder legibilidad de la factura.
const MAX_SIDE = 2000;
const COMPRESS_ABOVE = 600 * 1024;
async function compressImage(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return;
  try {
    if (fs.statSync(absPath).size <= COMPRESS_ABOVE) return;
    const sharp = require('sharp');
    let img = sharp(absPath).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    if (ext === '.png') img = img.png({ compressionLevel: 9, palette: true });
    else if (ext === '.webp') img = img.webp({ quality: 82 });
    else img = img.jpeg({ quality: 82, mozjpeg: true });
    const tmp = `${absPath}.tmp${ext}`;
    await img.toFile(tmp);
    fs.renameSync(tmp, absPath);
  } catch (err) {
    console.warn('[fileStore] No se pudo comprimir', absPath, err.message);
  }
}

// Procesa un archivo recién subido por multer: HEIC → JPG, compresión y copia
// en la base de datos. Devuelve req.file actualizado.
async function processUpload(file) {
  if (!file) return file;
  await normalizeHeic(file);
  await compressImage(file.path);
  file.size = fs.statSync(file.path).size;
  await persistFile(file.path, file.mimetype);
  return file;
}

// Middleware para GET /uploads/...: si el archivo no está en el disco de este
// contenedor, lo restaura desde la base de datos antes de que lo sirva static.
function restoreMiddleware(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let rel;
  try { rel = decodeURIComponent(req.path.replace(/^\/+/, '')); } catch { return next(); }
  const r = resolveRef(rel);
  if (!r || fs.existsSync(r.abs)) return next();
  restoreFile(r.rel).then(() => next()).catch(() => next());
}

// Al arrancar: copia a la base de datos los archivos que ya están en disco y
// aún no tienen copia (facturas, fotos de kilometraje y firmas referenciadas).
async function backfillReferencedFiles() {
  const refs = new Set();
  const [expenses, entries, users] = await Promise.all([
    db.Expense.findAll({ attributes: ['imagen_url'], where: { imagen_url: { [db.Sequelize.Op.ne]: null } } }),
    db.KilometrageEntry.findAll({ attributes: ['peaje_foto', 'parqueadero_foto', 'taxi_foto', 'otros_foto'] }),
    db.User.findAll({ attributes: ['firma_url'], where: { firma_url: { [db.Sequelize.Op.ne]: null } } }),
  ]);
  expenses.forEach(e => refs.add(e.imagen_url));
  entries.forEach(e => ['peaje_foto', 'parqueadero_foto', 'taxi_foto', 'otros_foto'].forEach(k => e[k] && refs.add(e[k])));
  users.forEach(u => refs.add(u.firma_url));

  let copiados = 0, faltantes = 0;
  for (const ref of refs) {
    const r = resolveRef(ref);
    if (!r) continue;
    const yaEsta = await db.StoredFile.count({ where: { path: r.rel } });
    if (yaEsta) continue;
    // Ni en disco ni en la base de datos: se perdió en un redespliegue anterior
    if (!fs.existsSync(r.abs)) { faltantes++; continue; }
    await persistFile(r.abs);
    copiados++;
  }
  return { referenciados: refs.size, copiados, faltantes };
}

module.exports = {
  resolveRef,
  persistFile,
  restoreFile,
  ensureLocal,
  removeFile,
  normalizeHeic,
  compressImage,
  processUpload,
  restoreMiddleware,
  backfillReferencedFiles,
};
