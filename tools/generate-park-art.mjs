#!/usr/bin/env node
/* Deterministic original park textures and quiet pixel landmarks. */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(pathToFileURL(path.join(root, 'visual-theme.js')));
const palette = globalThis.PICKLEBOARD_VISUAL.palette;
const rgba = (hex, alpha = 255) => {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), alpha];
};
const C = Object.fromEntries(Object.entries(palette).map(([name, value]) => [name, rgba(value)]));
const mix = (a, b, amount) => a.map((value, index) => Math.round(value * (1 - amount) + b[index] * amount));

class Canvas {
  constructor(width, height) { this.width = width; this.height = height; this.data = Buffer.alloc(width * height * 4); }
  set(x, y, color) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data.set(color, (y * this.width + x) * 4);
  }
  rect(x, y, width, height, color) { for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) this.set(xx, yy, color); }
  polygon(points, color) {
    const minY = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...points.map(point => point[1]))));
    for (let y = minY; y <= maxY; y += 1) {
      const crossings = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y)) crossings.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i < crossings.length; i += 2) for (let x = Math.ceil(crossings[i]); x <= Math.floor(crossings[i + 1] ?? crossings[i]); x += 1) this.set(x, y, color);
    }
  }
}

const crc32 = buffer => {
  let crc = 0xffffffff;
  for (const value of buffer) { crc ^= value; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, body) => {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(body.length); crc.writeUInt32BE(crc32(Buffer.concat([name, body])));
  return Buffer.concat([length, name, body, crc]);
};
const encodePng = canvas => {
  const scanlines = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) { scanlines[y * (canvas.width * 4 + 1)] = 0; canvas.data.copy(scanlines, y * (canvas.width * 4 + 1) + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4); }
  const header = Buffer.alloc(13); header.writeUInt32BE(canvas.width); header.writeUInt32BE(canvas.height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

// Sparse deliberately placed clusters: no per-pixel random noise or false court lines.
const texture = (base, accents, seed, pattern = 0) => {
  const c = new Canvas(128,128);c.rect(0,0,128,128,base);
  const clusters=[[8,12],[37,7],[78,20],[111,9],[22,49],[59,43],[97,55],[7,88],[45,79],[81,99],[112,87],[30,115],[65,120]];
  for(const [i,[x,y]] of clusters.entries()){
    if(pattern===2&&i%3)continue;
    const color=accents[i%accents.length];
    c.rect(x,y,pattern===2?2:4,2,color);c.rect(x+2,y-1,2,1,color);
    if(seed===2){c.rect(x+1,y-3,1,3,color);c.rect(x+4,y-2,1,2,color);}
  }
  return c;
};

const tree = () => {
  const c = new Canvas(64, 64);
  c.ellipse = (cx, cy, rx, ry, color) => { for (let y = cy - ry; y <= cy + ry; y += 1) for (let x = cx - rx; x <= cx + rx; x += 1) if (((x - cx) ** 2) / rx ** 2 + ((y - cy) ** 2) / ry ** 2 <= 1) c.set(x, y, color); };
  c.ellipse(32, 57, 21, 4, [...C.parkShadow.slice(0, 3), 90]);
  c.rect(27, 37, 10, 20, C.parkWood); c.rect(30, 36, 5, 21, C.parkShadow);
  c.ellipse(22, 27, 16, 17, C.grassDeep); c.ellipse(39, 27, 16, 18, C.grassDeep); c.ellipse(31, 17, 17, 15, C.grassLight);
  c.rect(18, 21, 5, 5, C.surround); c.rect(39, 15, 5, 5, C.surround); c.rect(27, 8, 8, 4, C.grassLight);
  return c;
};
const shrub = () => {
  const c = new Canvas(64, 64);
  c.rect(7, 48, 50, 7, [...C.parkShadow.slice(0, 3), 90]);
  c.polygon([[8, 49], [12, 32], [21, 24], [32, 30], [41, 22], [53, 30], [57, 49]], C.grassDeep);
  c.rect(15, 34, 12, 9, C.grassLight); c.rect(34, 29, 11, 9, C.surround); c.rect(24, 42, 16, 7, C.grassLight);
  return c;
};
const bench = () => {
  const c = new Canvas(64, 64);
  c.rect(6, 52, 52, 5, [...C.parkShadow.slice(0, 3), 90]);
  c.rect(10, 28, 44, 8, C.parkWood); c.rect(10, 39, 44, 7, C.parkWood); c.rect(13, 30, 38, 3, C.orangeDark);
  c.rect(14, 46, 5, 9, C.navyDark); c.rect(45, 46, 5, 9, C.navyDark); c.rect(8, 26, 5, 24, C.navyDark); c.rect(51, 26, 5, 24, C.navyDark);
  return c;
};
const glyphs = {
  P: ['110','101','110','100','100'], I: ['111','010','010','010','111'], C: ['111','100','100','100','111'], K: ['101','101','110','101','101'], L: ['100','100','100','100','111'], E: ['111','100','110','100','111'], B: ['110','101','110','101','110'], A: ['010','101','111','101','101'], R: ['110','101','110','101','101'], H: ['101','101','111','101','101']
};
const text = (c, value, x, y, color, scale = 1) => {
  for (const letter of value) {
    const pattern = glyphs[letter];
    if (!pattern) { x += 4 * scale; continue; }
    pattern.forEach((row, dy) => [...row].forEach((pixel, dx) => { if (pixel === '1') c.rect(x + dx * scale, y + dy * scale, scale, scale, color); }));
    x += 4 * scale;
  }
};
const sign = () => {
  const c = new Canvas(64, 64);
  c.rect(26, 23, 12, 34, C.parkWood); c.rect(29, 21, 6, 36, C.parkShadow);
  c.rect(8, 8, 48, 23, C.navyDark); c.rect(12, 12, 40, 15, C.parkSign);
  // The border sign is a readable help affordance; product identity lives in banner().
  text(c, 'HELP', 16, 15, C.grassDeep, 2);
  c.rect(19, 57, 26, 3, [...C.parkShadow.slice(0, 3), 90]);
  return c;
};
const banner = () => {
  const c = new Canvas(128, 32);
  c.rect(1, 1, 126, 30, C.navyDark);
  c.rect(4, 4, 120, 24, C.parkSign);
  c.rect(6, 6, 116, 20, C.orangeDark);
  // A compact two-line wordmark keeps every doubled pixel legible in the park border.
  text(c, 'PICKLEBALL', 24, 7, C.grassDeep, 2);
  text(c, 'PARK', 48, 18, C.parkShadow, 2);
  return c;
};

const assets = [
  ['quiet-court.png', texture(C.court, [mix(C.court, C.navyLight, 0.16), mix(C.court, C.kitchen, 0.14)], 1, 2)],
  ['grass.png', texture(C.surround, [mix(C.surround, C.grassDeep, 0.28), mix(C.surround, C.grassLight, 0.24)], 2, 1)],
  ['path.png', texture(C.path, [mix(C.path, C.orangeDark, 0.24), mix(C.path, C.orangeLight, 0.16)], 3, 1)],
  ['tree.png', tree()], ['shrub.png', shrub()], ['bench.png', bench()], ['sign.png', sign()], ['banner.png', banner()]
];
const output = [];
for (const [name, canvas] of assets) {
  const bytes = encodePng(canvas); const target = path.join(root, 'assets/park', name);
  await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  output.push({ name: `assets/park/${name}`, width: canvas.width, height: canvas.height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 12) });
}
console.log(JSON.stringify({ output }, null, 2));
