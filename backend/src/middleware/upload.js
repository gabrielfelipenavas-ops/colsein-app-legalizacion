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

const upload = multer({
  storage,
  fileFilter,
  // 25 MB por defecto: las fotos de celular modernas suelen pesar más de 10 MB,
  // y rechazarlas hacía fallar el guardado del gasto con su soporte.
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '26214400') },
});

module.exports = upload;
