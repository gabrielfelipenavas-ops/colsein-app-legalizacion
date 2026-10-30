const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = path.join(uploadDir, new Date().toISOString().slice(0, 7)); // YYYY-MM
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

// Solo se aceptan imágenes y PDF. La validación se basa en la EXTENSIÓN (no en el
// mimetype, que los teléfonos suelen reportar mal), porque la extensión es la que
// determina cómo el navegador sirve el archivo. Esto bloquea archivos peligrosos
// como .html o .svg que el navegador podría ejecutar (riesgo de XSS almacenado).
const EXTENSIONES_PERMITIDAS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'pdf'];

const fileFilter = (req, file, cb) => {
  const ext = (file.originalname || '').toLowerCase().split('.').pop();
  if (EXTENSIONES_PERMITIDAS.includes(ext)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, HEIC…) o PDF.'), false);
};

const multerUpload = multer({
  storage,
  fileFilter,
  // 25 MB por defecto: las fotos de celular modernas suelen pesar más de 10 MB,
  // y rechazarlas hacía fallar el guardado del gasto con su soporte.
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '26214400') },
});

// Tamaño máximo (lado mayor, en píxeles) con el que se guardan las fotos.
// Suficiente para leer cualquier renglón de una factura y pesa ~10 veces menos
// que la foto original del celular (que puede superar los 10 MB).
const LADO_MAX_FOTO = parseInt(process.env.UPLOAD_MAX_PX || '2000');

// Normaliza la imagen subida: aplica la orientación EXIF, convierte HEIC/WEBP/
// GIF/BMP/PNG a JPG (que el navegador y el PDF entienden) y la reduce de
// tamaño. Los PDF se dejan tal cual. Actualiza req.file.path / filename.
async function normalizarImagen(file) {
  const ext = path.extname(file.path).toLowerCase();
  if (ext === '.pdf') return;
  try {
    const sharp = require('sharp');
    const nuevaRuta = file.path.replace(/\.[^.]+$/, '') + '.jpg';
    // sharp no puede leer y escribir el mismo archivo: se escribe a un temporal
    const temporal = nuevaRuta + '.tmp';
    await sharp(file.path)
      .rotate() // orientación EXIF (fotos tomadas en vertical con el celular)
      .flatten({ background: '#ffffff' }) // PNG/WEBP con transparencia → fondo blanco
      .resize({ width: LADO_MAX_FOTO, height: LADO_MAX_FOTO, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toFile(temporal);
    if (nuevaRuta !== file.path) { try { fs.unlinkSync(file.path); } catch {} }
    fs.renameSync(temporal, nuevaRuta);
    file.path = nuevaRuta;
    file.filename = path.basename(nuevaRuta);
    file.mimetype = 'image/jpeg';
    file.size = fs.statSync(nuevaRuta).size;
    file.originalname = (file.originalname || 'imagen').replace(/\.[^.]+$/, '') + '.jpg';
  } catch (err) {
    // Si sharp no puede leerla (formato raro), se conserva el archivo original
    console.warn(`[upload] No se pudo normalizar ${path.basename(file.path)}, se guarda tal cual:`, err.message);
  }
}

// Después de que multer deja el archivo en el disco: lo normaliza y guarda la
// copia permanente en la base de datos (el disco de Railway se borra en cada
// despliegue; ver services/archivos.js).
function persistir(req, res, next) {
  if (!req.file) return next();
  (async () => {
    await normalizarImagen(req.file);
    // Ruta relativa a UPLOAD_DIR y URL pública, listas para guardar en la BD
    req.file.rel = path.relative(path.resolve(uploadDir), path.resolve(req.file.path)).replace(/\\/g, '/');
    req.file.url = `/uploads/${req.file.rel}`;
    const archivos = require('../services/archivos');
    await archivos.guardar(req.file.path);
  })().then(() => next()).catch(next);
}

// Misma interfaz que multer (upload.single('campo')), pero devolviendo la
// cadena [multer, persistir]. Express acepta arreglos de middlewares.
const upload = {
  single: (campo) => [multerUpload.single(campo), persistir],
  _multer: multerUpload,
};

module.exports = upload;
