import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makeIcon(size) {
  // Simple flat "waveform on purple" glyph, solid background + a few white bars.
  const bg = [0x6d, 0x28, 0xd9]; // purple-700
  const fg = [0xff, 0xff, 0xff];
  const rowBytes = size * 3;
  const raw = Buffer.alloc((rowBytes + 1) * size);

  const barW = Math.max(1, Math.round(size / 10));
  const gap = Math.max(1, Math.round(size / 14));
  const bars = 5;
  const totalW = bars * barW + (bars - 1) * gap;
  const startX = Math.round((size - totalW) / 2);
  const heights = [0.4, 0.7, 1.0, 0.6, 0.35];

  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      let isBar = false;
      for (let b = 0; b < bars; b++) {
        const bx0 = startX + b * (barW + gap);
        const bx1 = bx0 + barW;
        if (x >= bx0 && x < bx1) {
          const h = heights[b] * size * 0.6;
          const yMid = size / 2;
          if (y >= yMid - h / 2 && y <= yMid + h / 2) isBar = true;
        }
      }
      const px = rowStart + 1 + x * 3;
      const color = isBar ? fg : bg;
      raw[px] = color[0];
      raw[px + 1] = color[1];
      raw[px + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(`extension/icons/icon${size}.png`, makeIcon(size));
}
console.log("Icons written.");
