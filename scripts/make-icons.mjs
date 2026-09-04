// Generates the PNG extension icons (icons/icon{16,32,48,128}.png) with zero
// dependencies: pure Node zlib PNG encoding + a geometric shield/checkmark design.
// Usage: bun scripts/make-icons.mjs   (or: node scripts/make-icons.mjs)
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "icons");
mkdirSync(OUT_DIR, { recursive: true });

// ---- Minimal PNG encoder -------------------------------------------------
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---- Design (128x128 design space, same as icon.svg) ---------------------
const S = 128;
const BG = [11, 16, 24, 255];
const GREEN = [103, 232, 162, 255];
const SHIELD = [
  [64, 18], [98, 31], [98, 59], [64, 110], [30, 59], [30, 31], [64, 18],
];
const CHECK = [[47, 65], [58, 76], [82, 49]];
const STROKE_HALF = 4; // stroke width 8, half-width

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function inRoundedRect(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), S - radius);
  const cy = Math.min(Math.max(y, radius), S - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

function minPolylineDist(x, y, points) {
  let d = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    d = Math.min(d, distToSegment(x, y, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]));
  }
  return d;
}

function pixel(x, y) {
  if (!inRoundedRect(x, y, 26)) return [0, 0, 0, 0];
  const shieldD = minPolylineDist(x, y, SHIELD);
  if (shieldD <= STROKE_HALF) return GREEN;
  const checkD = minPolylineDist(x, y, CHECK);
  if (checkD <= STROKE_HALF) return GREEN;
  return BG;
}

function render(size) {
  const scale = S / size;
  const ss = 2; // 2x2 supersampling for smooth edges
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / ss) * scale, (y + (sy + 0.5) / ss) * scale);
          r += pr; g += pg; b += pb; a += pa;
        }
      }
      const n = ss * ss;
      const i = (y * size + x) * 4;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = Math.round(a / n);
    }
  }
  return buf;
}

for (const size of [16, 32, 48, 128]) {
  const path = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(path, encodePng(size, size, render(size)));
  console.log(`wrote ${path}`);
}