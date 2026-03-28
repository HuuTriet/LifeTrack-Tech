/**
 * Tạo icon PNG cho extension bằng Node.js thuần (không cần thư viện ngoài).
 * Chạy: node create-icons.js
 */
const fs = require('fs');
const path = require('path');

// ── Tạo PNG tối giản bằng raw bytes ──────────────────────────────────────────

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function deflateRaw(data) {
  // Simple uncompressed deflate block
  const parts = [];
  let offset = 0;
  while (offset < data.length) {
    const blockSize = Math.min(65535, data.length - offset);
    const isLast = offset + blockSize >= data.length ? 1 : 0;
    const header = Buffer.alloc(5);
    header[0] = isLast;
    header.writeUInt16LE(blockSize, 1);
    header.writeUInt16LE(~blockSize & 0xffff, 3);
    parts.push(header, data.slice(offset, offset + blockSize));
    offset += blockSize;
  }
  return Buffer.concat(parts);
}

function adler32(data) {
  let s1 = 1, s2 = 0;
  for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
  return ((s2 << 16) | s1) >>> 0;
}

function zlib(data) {
  const deflated = deflateRaw(data);
  const header = Buffer.from([0x78, 0x01]); // zlib header (no compression)
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(adler32(data) >>> 0);
  return Buffer.concat([header, deflated, adler]);
}

function makePNG(size, drawFn) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Draw pixels (RGB)
  const pixels = [];
  for (let y = 0; y < size; y++) {
    pixels.push(0); // filter type: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y, size);
      pixels.push(r, g, b);
    }
  }

  const rawData = Buffer.from(pixels);
  const idat = zlib(rawData);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Vẽ icon LifeTrack ────────────────────────────────────────────────────────

function drawLifeTrackIcon(x, y, size) {
  const cx = size / 2, cy = size / 2;
  const radius = size / 2 - 1;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

  // Outside circle → transparent (white background)
  if (dist > radius) return [250, 248, 245];

  // Gradient: deep blue (#2E5C7F) to light blue (#4A8FB8)
  const t = (x + y) / (size * 2);
  const r = Math.round(0x2E + t * (0x4A - 0x2E));
  const g = Math.round(0x5C + t * (0x8F - 0x5C));
  const bv = Math.round(0x7F + t * (0xB8 - 0x7F));

  // White cross (pill symbol) in center
  const armW = Math.max(1, Math.floor(size * 0.13));
  const armL = Math.floor(size * 0.30);
  const inHoriz = Math.abs(y - cy) <= armW && Math.abs(x - cx) <= armL;
  const inVert  = Math.abs(x - cx) <= armW && Math.abs(y - cy) <= armL;
  if (inHoriz || inVert) return [255, 255, 255];

  return [r, g, bv];
}

// ── Generate & save ───────────────────────────────────────────────────────────

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

for (const size of [16, 48, 128]) {
  const png = makePNG(size, drawLifeTrackIcon);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ Đã tạo: icons/icon${size}.png (${png.length} bytes)`);
}

console.log('\n✔ Icons đã sẵn sàng trong thư mục edge-extension/icons/');
