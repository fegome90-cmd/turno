// Minimal PNG reader for one pixel of 8-bit RGB/RGBA, non-interlaced images (Chromium screencast frames).
import zlib from 'node:zlib';

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function readPngPixel(buf: Buffer, x: number, y: number): {r: number; g: number; b: number; a: number; width: number; height: number} {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`unsupported PNG: depth ${bitDepth}, color ${colorType}, interlace ${interlace}`);
  }
  if (x < 0 || y < 0 || x >= width || y >= height) throw new Error('pixel outside image');
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const cur = out.subarray(row * stride, (row + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let pred: number;
      switch (filter) {
        case 0: pred = 0; break;
        case 1: pred = left; break;
        case 2: pred = up; break;
        case 3: pred = (left + up) >> 1; break;
        case 4: pred = paeth(left, up, upLeft); break;
        default: throw new Error(`bad PNG filter ${filter}`);
      }
      cur[i] = (line[i] + pred) & 0xff;
    }
    prev = cur;
  }
  const i = y * stride + x * bpp;
  return {r: out[i], g: out[i + 1], b: out[i + 2], a: bpp === 4 ? out[i + 3] : 255, width, height};
}
