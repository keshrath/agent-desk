#!/usr/bin/env node
// Tiny placeholder icon generator. Writes valid PNGs at 192px and 512px
// containing a solid Agent Desk accent-colored square with a white "AD"
// monogram. Real branded icons should replace these for production.
//
// Output: packages/pwa/public/icons/{192,512}.png
//
// Implementation note: PNG with no compression and a single IDAT chunk.
// We hand-roll it to avoid pulling in a dep just for placeholder art.

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACCENT = [0x5d, 0x8d, 0xa8, 0xff]; // #5d8da8 with alpha
const WHITE = [0xff, 0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function buildPng(size) {
  // RGBA pixel buffer
  const rowBytes = size * 4;
  const raw = Buffer.alloc(size * (rowBytes + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const off = y * (rowBytes + 1) + 1 + x * 4;
      // Draw a centered "AD" monogram as a pair of vertical bars +
      // a horizontal bar — visually distinguishable, no font needed.
      const cx = size / 2;
      const cy = size / 2;
      const monogramHalf = size * 0.18;
      const inA =
        x >= cx - monogramHalf && x <= cx - monogramHalf * 0.4 && y >= cy - monogramHalf && y <= cy + monogramHalf;
      const inAcrossbar =
        x >= cx - monogramHalf &&
        x <= cx - monogramHalf * 0.4 &&
        y >= cy - monogramHalf * 0.1 &&
        y <= cy + monogramHalf * 0.1;
      const inD =
        x >= cx + monogramHalf * 0.2 &&
        x <= cx + monogramHalf * 0.5 &&
        y >= cy - monogramHalf &&
        y <= cy + monogramHalf;
      const inDcurve =
        x >= cx + monogramHalf * 0.5 &&
        x <= cx + monogramHalf &&
        Math.abs(y - cy) <=
          Math.sqrt(Math.max(0, monogramHalf * monogramHalf - (x - cx - monogramHalf * 0.5) ** 2 * 4));
      const px = inA || inAcrossbar || inD || inDcurve ? WHITE : ACCENT;
      raw[off] = px[0];
      raw[off + 1] = px[1];
      raw[off + 2] = px[2];
      raw[off + 3] = px[3];
    }
  }

  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const iend = Buffer.alloc(0);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', iend)]);
}

for (const size of [192, 512]) {
  const out = join(__dirname, `${size}.png`);
  writeFileSync(out, buildPng(size));
  console.log(`wrote ${out}`);
}
