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

const fileFilter = (req, file, cb) => {
  // Accept any image/*, PDF, or common octet-stream (some phones send HEIC this way)
  const mt = (file.mimetype || '').toLowerCase();
  const ext = (file.originalname || '').toLowerCase().split('.').pop();
  const okMime = mt.startsWith('image/') || mt === 'application/pdf' || mt === 'application/octet-stream';
  const okExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'pdf'].includes(ext);
  if (okMime || okExt) return cb(null, true);
  cb(new Error(`Tipo de archivo no soportado: ${mt || ext}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
});

module.exports = upload;
