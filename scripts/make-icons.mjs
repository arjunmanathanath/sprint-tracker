// Generates PWA icons (PNG) without any image library: raw RGBA -> zlib -> PNG.
// Design: dark rounded tile with a 3/4 progress ring in the app accent colour.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x0f, 0x11, 0x15];
const ACCENT = [0x5e, 0xea, 0xd4]; // teal-300
const TRACK = [0x2a, 0x2f, 0x3a];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function render(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // Maskable icons must be full-bleed with content inside the central 80%.
  const scale = maskable ? 0.8 : 1;
  const radius = maskable ? 0 : size * 0.22;
  const rOuter = size * 0.36 * scale;
  const rInner = size * 0.26 * scale;
  const startAngle = -Math.PI / 2; // 12 o'clock
  const sweep = Math.PI * 1.5; // 3/4 of the ring
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      // rounded-rect alpha
      let alpha = 255;
      if (radius > 0) {
        const qx = Math.max(Math.abs(dx) - (c - radius), 0);
        const qy = Math.max(Math.abs(dy) - (c - radius), 0);
        const d = Math.hypot(qx, qy) - radius;
        alpha = Math.round(255 * Math.min(1, Math.max(0, 0.5 - d)));
      }
      let col = BG;
      const dist = Math.hypot(dx, dy);
      if (dist >= rInner && dist <= rOuter) {
        let a = Math.atan2(dy, dx) - startAngle;
        if (a < 0) a += Math.PI * 2;
        col = a <= sweep ? ACCENT : TRACK;
        // soften ring edges
        const edge = Math.min(dist - rInner, rOuter - dist);
        if (edge < 1) {
          const t = Math.max(0, edge);
          col = col.map((v, k) => Math.round(BG[k] + (v - BG[k]) * t));
        }
      }
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = alpha;
    }
  }
  return encodePng(size, px);
}

mkdirSync("public", { recursive: true });
writeFileSync("public/pwa-192.png", render(192, { maskable: false }));
writeFileSync("public/pwa-512.png", render(512, { maskable: false }));
writeFileSync("public/pwa-512-maskable.png", render(512, { maskable: true }));
writeFileSync("public/apple-touch-icon.png", render(180, { maskable: true }));
writeFileSync(
  "public/favicon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f1115"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#2a2f3a" stroke-width="6"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#5eead4" stroke-width="6"
    stroke-dasharray="94.2 125.7" stroke-linecap="round" transform="rotate(-90 32 32)"/>
</svg>
`,
);
console.log("icons written to public/");
