// Generador de íconos PWA de COLSEIN Legalizaciones.
// Toma el logo oficial (src/brand/logo.jpeg) y produce los íconos de la PWA.
// Uso: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public');
const source = join(root, 'src', 'brand', 'logo.jpeg');
mkdirSync(outDir, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Ícono normal: logo "contain" sobre fondo blanco (el logo ya trae margen).
async function normalIcon(size, file) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toFile(join(outDir, file));
  console.log(`✓ ${file} (${size}x${size})`);
}

// Ícono maskable: logo al ~72% centrado sobre blanco, con relleno alrededor
// para respetar la zona segura que recortan Android/iOS.
async function maskableIcon(size, file) {
  const inner = Math.round(size * 0.72);
  const logo = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: WHITE })
    .flatten({ background: WHITE })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(outDir, file));
  console.log(`✓ ${file} (${size}x${size}, maskable)`);
}

await normalIcon(192, 'pwa-192x192.png');
await normalIcon(512, 'pwa-512x512.png');
await normalIcon(180, 'apple-touch-icon.png');
await normalIcon(32, 'favicon-32x32.png');
await maskableIcon(512, 'maskable-512x512.png');
console.log('Íconos generados en', outDir);
