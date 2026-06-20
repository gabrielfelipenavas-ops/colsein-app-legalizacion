// Generador de íconos PWA de COLSEIN (sin dependencias externas).
// Dibuja una "C" blanca sobre fondo azul de marca y exporta PNGs.
// Uso: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

// Colores de marca (de tailwind/index.html: colsein #0062A3)
const BG = [0, 98, 163]; // azul COLSEIN
const FG = [255, 255, 255]; // blanco

// CRC32 para los chunks PNG
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // resto (compresión, filtro, interlace) = 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro None por scanline
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Dibuja el ícono: fondo azul + "C" blanca centrada.
// scale controla qué fracción del lienzo ocupa la "C" (para maskable: menor).
function drawIcon(size, { scale = 0.62, transparentBg = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = (size * scale) / 2;
  const rInner = rOuter * 0.58;
  const stroke = rOuter - rInner;
  const rMid = (rOuter + rInner) / 2;
  // Apertura de la "C" a la derecha (en radianes desde el eje +x)
  const gap = 0.62; // ~35°
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      let color = BG;
      let alpha = transparentBg ? 0 : 255;
      // Anillo de la "C"
      const inRing = r >= rInner && r <= rOuter;
      const ang = Math.atan2(dy, dx); // -PI..PI; 0 = derecha
      const inGap = Math.abs(ang) < gap;
      // Tapas redondeadas en los extremos de la apertura
      const capTop = Math.hypot(dx - rMid * Math.cos(gap), dy - rMid * Math.sin(gap)) <= stroke / 2;
      const capBot = Math.hypot(dx - rMid * Math.cos(-gap), dy - rMid * Math.sin(-gap)) <= stroke / 2;
      if ((inRing && !inGap) || capTop || capBot) {
        color = FG;
        alpha = 255;
      }
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = alpha;
    }
  }
  return encodePNG(size, size, buf);
}

const targets = [
  { name: 'pwa-192x192.png', size: 192, opts: {} },
  { name: 'pwa-512x512.png', size: 512, opts: {} },
  // Maskable: fondo a sangre + "C" dentro de la zona segura (~60%)
  { name: 'maskable-512x512.png', size: 512, opts: { scale: 0.5 } },
  // Apple touch icon: sin transparencia, fondo azul a sangre
  { name: 'apple-touch-icon.png', size: 180, opts: {} },
  { name: 'favicon-32x32.png', size: 32, opts: { scale: 0.78 } },
];

for (const t of targets) {
  const png = drawIcon(t.size, t.opts);
  writeFileSync(join(outDir, t.name), png);
  console.log(`✓ ${t.name} (${png.length} bytes)`);
}
console.log('Íconos generados en', outDir);
