// news-image-20261118 — "Sum up 18 November's world news in one image"
// Halaman depan koran visual 1024x1024, digambar prosedural penuh.
// Node 22, standard library saja (node:zlib, node:fs, node:path), tanpa network.
// Dijalankan dua kali harus menulis byte yang sama ke /output/entry.png
// (atau $MAKEFUN_OUTPUT_DIR bila diset). Tidak ada Date/random di sini.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;
const MARGIN = 32;

// ---- Warna (kertas koran terang, tinta gelap, aksen per cerita) ----
const PAPER: RGB = [247, 242, 231];
const INK: RGB = [22, 22, 22];
const INK_SOFT: RGB = [74, 74, 74];
const RED: RGB = [178, 34, 34];
const RULE: RGB = [22, 22, 22];
const CARD_LINE: RGB = [190, 182, 164];

type RGB = [number, number, number];

// ---- Encoder PNG murni: CRC32 + chunk + zlib deflate, filter 0 ----
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(rgb: Uint8Array, width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Kanvas RGB ----
const px = new Uint8Array(W * H * 3);

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

function hline(x: number, y: number, w: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGB): void {
  fillRect(x, y, 1, h, c);
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPx(cx + x, cy + y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGB, thick: number): void {
  for (let t = 0; t < thick; t++) {
    const rr = r - t;
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      setPx(Math.round(cx + rr * Math.cos(rad)), Math.round(cy + rr * Math.sin(rad)), c);
    }
  }
}

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      for (let x = lo; x <= hi; x++) setPx(x, y, c);
    }
  }
}

function rectBorder(x: number, y: number, w: number, h: number, c: RGB, thick: number): void {
  fillRect(x, y, w, thick, c);
  fillRect(x, y + h - thick, w, thick, c);
  fillRect(x, y, thick, h, c);
  fillRect(x + w - thick, y, thick, h, c);
}

// ---- Font bitmap 5x7, ditulis sendiri (huruf besar, angka, tanda baca) ----
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "%": ["10001", "10010", "00010", "00100", "01000", "01001", "10001"],
  "=": ["00000", "00000", "01110", "00000", "01110", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
};

// ---- Teks: gambar huruf bitmap, ukur lebar, bungkus kata ----
function charWidth(scale: number): number {
  return 6 * scale;
}

function textWidth(text: string, scale: number): number {
  return text.length * charWidth(scale) - scale;
}

function drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const glyph = FONT[ch] ?? FONT["?"];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === "1") {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB): void {
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    drawChar(upper[i], x + i * charWidth(scale), y, scale, c);
  }
}

function drawTextCentered(text: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(text, Math.round(cx - textWidth(text, scale) / 2), y, scale, c);
}

function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      // Kata yang terlalu panjang: potong per huruf.
      if (textWidth(w, scale) > maxWidth) {
        let part = "";
        for (const ch of w) {
          if (textWidth(part + ch, scale) <= maxWidth) part += ch;
          else {
            lines.push(part);
            part = ch;
          }
        }
        cur = part;
      } else {
        cur = w;
      }
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawWrapped(text: string, x: number, y: number, scale: number, maxWidth: number, lineGap: number, c: RGB): number {
  const lines = wrapText(text, scale, maxWidth);
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, y + i * (7 * scale + lineGap), scale, c);
  }
  return lines.length;
}

// ---- Ilustrasi prosedural per motif (tanpa foto, bentuk geometris) ----
type Motif = "globe" | "bars" | "sun" | "skyline" | "waves" | "court" | "storm" | "rocket" | "gulf" | "bridge" | "quad";

function thickLine(x0: number, y0: number, x1: number, y1: number, c: RGB, thick: number): void {
  // Garis tebal: gambar beberapa garis sejajar yang digeser tegak lurus.
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = Math.round((-dy / len) * 1);
  const ny = Math.round((dx / len) * 1);
  const half = Math.floor(thick / 2);
  for (let t = -half; t <= half; t++) {
    drawLine(x0 + nx * t, y0 + ny * t, x1 + nx * t, y1 + ny * t, c);
  }
}

interface Palette {
  sky: RGB;
  main: RGB;
  alt: RGB;
  ground: RGB;
}

function motifGlobe(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  const r = Math.floor(Math.min(w, h) * 0.36);
  fillCircle(cx, cy, r, p.main);
  fillCircle(cx - Math.floor(r * 0.38), cy - Math.floor(r * 0.3), Math.floor(r * 0.3), p.alt);
  fillCircle(cx + Math.floor(r * 0.42), cy + Math.floor(r * 0.28), Math.floor(r * 0.24), p.alt);
  fillCircle(cx + Math.floor(r * 0.1), cy + Math.floor(r * 0.45), Math.floor(r * 0.18), p.alt);
  circleOutline(cx, cy, r, INK, 3);
  drawLine(cx - r, cy, cx + r, cy, INK);
  // Meridian melengkung: dua busur vertikal dari garis-garis pendek.
  for (let a = -70; a <= 70; a += 4) {
    const rad = (a * Math.PI) / 180;
    const yy = cy + Math.round(r * Math.sin(rad));
    const xx = Math.round(r * 0.45 * Math.cos(rad));
    setPx(cx + xx, yy, INK);
    setPx(cx - xx, yy, INK);
  }
  fillRect(x, y + h - 10, w, 10, p.ground);
}

function motifBars(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const base = y + h - 24;
  const heights = [0.3, 0.45, 0.38, 0.62, 0.55, 0.8, 0.95];
  const bw = Math.floor(w / (heights.length * 2));
  for (let i = 0; i < heights.length; i++) {
    const bh = Math.floor((h - 48) * heights[i]);
    const bx = x + 14 + i * 2 * bw;
    fillRect(bx, base - bh, bw, bh, i === heights.length - 1 ? RED : p.main);
  }
  hline(x + 8, base, w - 16, INK);
  // Panah naik di atas batang.
  drawLine(x + 18, base - Math.floor((h - 48) * 0.4), x + w - 22, y + 16, RED);
  fillTriangle(x + w - 22, y + 16, x + w - 38, y + 18, x + w - 22, y + 32, RED);
  fillRect(x, y + h - 10, w, 10, p.ground);
}

function motifSun(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const cx = x + Math.floor(w * 0.72);
  const cy = y + Math.floor(h * 0.32);
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    drawLine(
      Math.round(cx + 34 * Math.cos(rad)),
      Math.round(cy + 34 * Math.sin(rad)),
      Math.round(cx + 48 * Math.cos(rad)),
      Math.round(cy + 48 * Math.sin(rad)),
      p.main,
    );
  }
  fillCircle(cx, cy, 30, p.main);
  // Bukit + tunas hijau (iklim / panen).
  fillCircle(x + Math.floor(w * 0.2), y + h + 30, Math.floor(w * 0.42), p.alt);
  fillCircle(x + Math.floor(w * 0.85), y + h + 18, Math.floor(w * 0.38), p.ground);
  drawLine(x + Math.floor(w * 0.2), y + h - 26, x + Math.floor(w * 0.2), y + h - 62, p.alt);
  fillTriangle(
    x + Math.floor(w * 0.2),
    y + h - 62,
    x + Math.floor(w * 0.2) + 26,
    y + h - 44,
    x + Math.floor(w * 0.2),
    y + h - 40,
    p.alt,
  );
}

function motifSkyline(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const base = y + h - 10;
  const towers = [0.5, 0.78, 0.62, 0.92, 0.58, 0.7];
  const tw = Math.floor(w / towers.length);
  for (let i = 0; i < towers.length; i++) {
    const th = Math.floor((h - 30) * towers[i]);
    const tx = x + i * tw + 4;
    fillRect(tx, base - th, tw - 8, th, p.main);
    // Jendela kuning menyala.
    for (let wy = base - th + 8; wy < base - 8; wy += 14) {
      for (let wx = tx + 5; wx < tx + tw - 12; wx += 12) {
        if ((wx + wy) % 28 < 14) fillRect(wx, wy, 5, 6, [250, 214, 90]);
      }
    }
  }
  fillRect(x, base, w, 10, p.ground);
}

function motifWaves(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  // Matahari kecil + tiga gelombang + perahu layar segitiga.
  fillCircle(x + Math.floor(w * 0.8), y + 26, 18, p.main);
  for (let row = 0; row < 3; row++) {
    const yy = y + Math.floor(h * 0.45) + row * 22;
    for (let xx = x + 6; xx < x + w - 6; xx += 4) {
      const wave = Math.round(5 * Math.sin(((xx - x) * Math.PI) / 26 + row));
      setPx(xx, yy + wave, p.alt);
      setPx(xx, yy + wave + 1, p.alt);
    }
  }
  const bx = x + Math.floor(w * 0.32);
  const by = y + Math.floor(h * 0.55);
  fillTriangle(bx, by, bx + 46, by, bx + 23, by + 16, p.ground);
  fillTriangle(bx + 23, by - 34, bx + 23, by, bx + 44, by, [255, 255, 255]);
  drawLine(bx + 23, by - 34, bx + 23, by, INK);
}

function motifCourt(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const base = y + h - 16;
  const cx = x + Math.floor(w / 2);
  // Atap segitiga + 3 pilar + dasar.
  fillTriangle(cx - Math.floor(w * 0.42), y + 34, cx + Math.floor(w * 0.42), y + 34, cx, y + 8, p.main);
  for (let i = -1; i <= 1; i++) {
    fillRect(cx + i * Math.floor(w * 0.24) - 8, y + 40, 16, base - y - 56, p.main);
  }
  fillRect(x + 14, base - 8, w - 28, 8, p.main);
  fillRect(x + 14, y + 34, w - 28, 6, p.main);
  fillCircle(cx, y + 22, 7, [250, 214, 90]);
}

function motifStorm(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const cy = y + Math.floor(h * 0.34);
  fillCircle(x + Math.floor(w * 0.34), cy, 34, p.main);
  fillCircle(x + Math.floor(w * 0.52), cy - 10, 40, p.main);
  fillCircle(x + Math.floor(w * 0.68), cy, 32, p.main);
  fillRect(x + Math.floor(w * 0.24), cy, Math.floor(w * 0.52), 22, p.main);
  // Petir kuning.
  const lx = x + Math.floor(w * 0.5);
  const ly = cy + 22;
  fillTriangle(lx - 4, ly, lx + 12, ly, lx + 2, ly + 26, [250, 214, 90]);
  fillTriangle(lx + 2, ly + 26, lx + 14, ly + 26, lx - 2, ly + 52, [250, 214, 90]);
  // Hujan: garis miring.
  for (let i = 0; i < 8; i++) {
    const rx = x + 16 + i * Math.floor((w - 32) / 8);
    drawLine(rx, y + h - 34, rx - 6, y + h - 16, p.alt);
  }
}

function motifRocket(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  // Bintang-bintang kecil.
  const stars: [number, number][] = [
    [0.12, 0.2],
    [0.24, 0.12],
    [0.82, 0.16],
    [0.9, 0.34],
    [0.1, 0.5],
    [0.88, 0.62],
  ];
  for (const [fx, fy] of stars) {
    fillRect(x + Math.floor(w * fx), y + Math.floor(h * fy), 4, 4, [255, 255, 255]);
  }
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2) - 6;
  fillTriangle(cx - 16, cy + 10, cx + 16, cy + 10, cx, cy - 42, p.main);
  fillRect(cx - 16, cy + 10, 32, 34, p.main);
  fillCircle(cx, cy + 18, 8, [255, 255, 255]);
  circleOutline(cx, cy + 18, 8, INK, 2);
  fillTriangle(cx - 16, cy + 44, cx - 30, cy + 58, cx - 16, cy + 34, RED);
  fillTriangle(cx + 16, cy + 44, cx + 30, cy + 58, cx + 16, cy + 34, RED);
  fillTriangle(cx - 8, cy + 44, cx + 8, cy + 44, cx, cy + 66, [250, 160, 40]);
}

// Peta Teluk: laut gelap, daratan pasir di utara dan selatan, Selat Hormuz
// sebagai celah di kanan, pulau Bahrain (kiri) dan Qeshm (kanan), dua panah
// berlawanan arah — drone merah menuju Bahrain, jet oranye menuju Qeshm.
function motifGulf(x: number, y: number, w: number, h: number, p: Palette): void {
  const SEA: RGB = [24, 68, 110];
  const SAND: RGB = [216, 198, 152];
  fillRect(x, y, w, h, SEA);
  // Daratan utara (Iran): pita pasir dengan celah Selat Hormuz di kanan.
  fillRect(x, y, Math.floor(w * 0.6), 40, SAND);
  fillRect(x + Math.floor(w * 0.68), y, w - Math.floor(w * 0.68), 40, SAND);
  fillTriangle(x, y + 40, x + 60, y + 40, x + 30, y + 58, SAND);
  fillTriangle(x + Math.floor(w * 0.4), y + 40, x + Math.floor(w * 0.6), y + 40, x + Math.floor(w * 0.5), y + 62, SAND);
  // Daratan selatan (jazirah Arab): pita pasir bawah.
  fillRect(x, y + h - 44, w, 44, SAND);
  fillTriangle(x + Math.floor(w * 0.3), y + h - 44, x + Math.floor(w * 0.55), y + h - 44, x + Math.floor(w * 0.42), y + h - 64, SAND);
  fillTriangle(x + Math.floor(w * 0.7), y + h - 44, x + w, y + h - 44, x + Math.floor(w * 0.85), y + h - 60, SAND);
  // Pulau Bahrain: titik pasir kecil + cincin radar, di kiri-tengah.
  const bx = x + Math.floor(w * 0.3);
  const by = y + Math.floor(h * 0.56);
  fillCircle(bx, by, 11, SAND);
  circleOutline(bx, by, 16, [255, 255, 255], 2);
  drawLine(bx, by, bx + 14, by - 8, [255, 255, 255]);
  // Pulau Qeshm: pulau pasir memanjang di kanan, dekat selat.
  const qx = x + Math.floor(w * 0.74);
  const qy = y + Math.floor(h * 0.44);
  fillCircle(qx - 16, qy, 12, SAND);
  fillCircle(qx + 8, qy, 12, SAND);
  fillRect(qx - 16, qy - 12, 24, 24, SAND);
  // Panah drone (merah): dari Qeshm menuju Bahrain.
  thickLine(qx - 30, qy + 6, bx + 24, by - 4, [220, 40, 30], 5);
  fillTriangle(bx + 24, by - 4, bx + 40, by - 12, bx + 40, by + 6, [220, 40, 30]);
  fillCircle(qx - 34, qy + 8, 5, [220, 40, 30]);
  // Panah jet (oranye): dari Bahrain menuju Qeshm, jalur bawah.
  thickLine(bx + 6, by + 18, qx - 26, qy + 22, [232, 120, 20], 5);
  fillTriangle(qx - 26, qy + 22, qx - 42, qy + 14, qx - 42, qy + 32, [232, 120, 20]);
  // Label peta, putih di atas laut, huruf cukup besar (skala 4 = 28 px).
  // Tiap label diberi latar laut gelap agar tetap kontras walau menyentuh pasir.
  fillRect(bx - 84, by + 20, 176, 40, [16, 48, 80]);
  drawText("BAHRAIN", bx - 78, by + 26, 4, [255, 255, 255]);
  fillRect(qx - 12, qy + 28, 128, 40, [16, 48, 80]);
  drawText("QESHM", qx - 6, qy + 34, 4, [255, 255, 255]);
  void p;
}

// Jembatan lengkung patah: geladak biru terputus di tengah, lengkung kuning
// hanya separuh kiri dan separuh kanan yang turun, potongan jatuh + asap.
function motifBridge(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const deckY = y + Math.floor(h * 0.48);
  const cx = x + Math.floor(w / 2);
  const rx = Math.floor(w * 0.42);
  const ry = Math.floor(h * 0.34);
  // Air di bawah.
  fillRect(x, y + Math.floor(h * 0.72), w, h - Math.floor(h * 0.72), [38, 98, 168]);
  // Lengkung kuning: busur kiri utuh, busur kanan turun 14 px (patah).
  for (let a = 180; a <= 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    const pxp = Math.round(cx + rx * Math.cos(rad));
    const pyp = Math.round(deckY - ry * Math.sin(rad));
    if (a <= 258) {
      fillCircle(pxp, pyp, 4, [255, 215, 0]);
    } else if (a >= 282) {
      fillCircle(pxp, pyp + 14, 4, [255, 215, 0]);
    }
  }
  // Geladak biru: kiri utuh, kanan miring turun, celah di tengah.
  thickLine(x + 8, deckY, cx - 26, deckY, [0, 87, 183], 7);
  thickLine(cx + 26, deckY + 14, x + w - 8, deckY + 22, [0, 87, 183], 7);
  // Potongan geladak jatuh ke air, miring.
  thickLine(cx - 24, deckY + 8, cx + 16, deckY + 40, [90, 110, 130], 8);
  // Asap abu-abu di atas celah.
  fillCircle(cx - 8, deckY - ry - 6, 12, [150, 150, 150]);
  fillCircle(cx + 12, deckY - ry - 14, 15, [170, 170, 170]);
  fillCircle(cx + 28, deckY - ry - 4, 10, [150, 150, 150]);
  // Penyangga jembatan.
  fillRect(x + 40, deckY, 8, y + h - deckY - Math.floor(h * 0.28), [0, 87, 183]);
  fillRect(x + w - 48, deckY + 14, 8, y + h - deckY - Math.floor(h * 0.28) - 14, [0, 87, 183]);
}

// Empat bendera Quad berjejer + garis rute emas dan pesawat putih kecil.
function motifQuad(x: number, y: number, w: number, h: number, p: Palette): void {
  fillRect(x, y, w, h, p.sky);
  const fw = Math.floor((w - 30) / 4);
  const fh = Math.min(56, h - 26);
  const fy = y + 6;
  const fx0 = x + 6;
  // Bendera AS: garis merah-putih + kanton biru.
  for (let s = 0; s < 7; s++) {
    fillRect(fx0, fy + Math.floor((fh * s) / 7), fw, Math.ceil(fh / 7), s % 2 === 0 ? [178, 34, 52] : [255, 255, 255]);
  }
  fillRect(fx0, fy, Math.floor(fw * 0.45), Math.floor(fh * 0.55), [30, 50, 110]);
  // Bendera Jepang: putih + lingkaran merah.
  const jx = fx0 + fw + 6;
  fillRect(jx, fy, fw, fh, [255, 255, 255]);
  fillCircle(jx + Math.floor(fw / 2), fy + Math.floor(fh / 2), Math.floor(fh * 0.3), [188, 0, 45]);
  // Bendera Australia: biru + bintang putih.
  const ax = jx + fw + 6;
  fillRect(ax, fy, fw, fh, [0, 40, 104]);
  fillRect(ax + 8, fy + 8, 3, 3, [255, 255, 255]);
  fillRect(ax + Math.floor(fw * 0.6), fy + 10, 4, 4, [255, 255, 255]);
  fillRect(ax + Math.floor(fw * 0.5), fy + Math.floor(fh * 0.6), 4, 4, [255, 255, 255]);
  fillRect(ax + Math.floor(fw * 0.75), fy + Math.floor(fh * 0.55), 3, 3, [255, 255, 255]);
  // Bendera India: tiga lajur + roda navy.
  const ix = ax + fw + 6;
  fillRect(ix, fy, fw, Math.floor(fh / 3), [255, 153, 51]);
  fillRect(ix, fy + Math.floor(fh / 3), fw, Math.floor(fh / 3), [255, 255, 255]);
  fillRect(ix, fy + Math.floor(2 * fh / 3), fw, fh - Math.floor(2 * fh / 3), [19, 136, 8]);
  fillCircle(ix + Math.floor(fw / 2), fy + Math.floor(fh / 2), 6, [6, 62, 132]);
  // Garis rute emas putus-putus + pesawat putih di ujung kanan.
  const ry = y + h - 10;
  for (let xx = x + 10; xx < x + w - 40; xx += 16) hline(xx, ry, 9, [212, 175, 55]);
  const pxp = x + w - 34;
  fillTriangle(pxp, ry - 8, pxp + 22, ry, pxp, ry + 8, [255, 255, 255]);
  fillTriangle(pxp + 2, ry - 2, pxp + 14, ry - 12, pxp + 10, ry - 2, [255, 255, 255]);
  fillTriangle(pxp + 2, ry + 2, pxp + 14, ry + 12, pxp + 10, ry + 2, [255, 255, 255]);
  void p;
}

function drawMotif(kind: Motif, x: number, y: number, w: number, h: number, p: Palette): void {
  rectBorder(x, y, w, h, INK, 3);
  const ix = x + 3;
  const iy = y + 3;
  const iw = w - 6;
  const ih = h - 6;
  if (kind === "globe") motifGlobe(ix, iy, iw, ih, p);
  else if (kind === "bars") motifBars(ix, iy, iw, ih, p);
  else if (kind === "sun") motifSun(ix, iy, iw, ih, p);
  else if (kind === "skyline") motifSkyline(ix, iy, iw, ih, p);
  else if (kind === "waves") motifWaves(ix, iy, iw, ih, p);
  else if (kind === "court") motifCourt(ix, iy, iw, ih, p);
  else if (kind === "storm") motifStorm(ix, iy, iw, ih, p);
  else if (kind === "gulf") motifGulf(ix, iy, iw, ih, p);
  else if (kind === "bridge") motifBridge(ix, iy, iw, ih, p);
  else if (kind === "quad") motifQuad(ix, iy, iw, ih, p);
  else motifRocket(ix, iy, iw, ih, p);
}

// ---- Cerita asli 18 November 2026 (dari DESIGN.md, terverifikasi) ----
// LEAD: AS-Iran di Teluk. Panel 2: Jembatan Crimea. Panel 3: Quad Manila.
// Panel 4 (strip bawah): Dhoni pensiun dari IPL.
interface Story {
  kicker: string;
  headline: string;
  summary: string;
  motif: Motif;
  palette: Palette;
}

const LEAD: Story = {
  kicker: "GULF",
  headline: "US STRIKES IRAN AFTER DRONE ATTACK",
  summary: "US JETS HIT QESHM AFTER IRAN DRONES TARGET BAHRAIN",
  motif: "gulf",
  palette: { sky: [24, 68, 110], main: [220, 40, 30], alt: [232, 120, 20], ground: [216, 198, 152] },
};

const PANEL_LEFT: Story = {
  kicker: "UKRAINE",
  headline: "UKRAINE HITS CRIMEA BRIDGE AGAIN",
  summary: "ROAD ARCH FALLS AS RUSSIA STRIKES KYIV BRIDGES IN REPLY",
  motif: "bridge",
  palette: { sky: [214, 228, 240], main: [0, 87, 183], alt: [255, 215, 0], ground: [38, 98, 168] },
};

const PANEL_RIGHT: Story = {
  kicker: "ASIA",
  headline: "TRUMP LANDS IN MANILA FOR QUAD",
  summary: "FIRST QUAD TALKS IN TWO YEARS, AHEAD OF CHINA VISIT",
  motif: "quad",
  palette: { sky: [31, 56, 100], main: [212, 175, 55], alt: [255, 255, 255], ground: [31, 56, 100] },
};

const PANEL_STRIP: Story = {
  kicker: "CRICKET",
  headline: "DHONI RETIRES FROM THE IPL",
  summary: "CSK LEGEND, 45, ENDS 19-YEAR CAREER; NOW TEAM MENTOR",
  motif: "sun",
  palette: { sky: [249, 205, 5], main: [31, 56, 100], alt: [255, 255, 255], ground: [249, 205, 5] },
};

// ---- Komposisi halaman depan koran 1024x1024 (layout DESIGN.md) ----
// Hanya 10 baris teks (kicker + tanggal 2 baris + 4 headline + 4 ringkasan)
// plus label peta BAHRAIN/QESHM dan angka 7 Dhoni. Tanpa footer/byline.
function compose(): void {
  fillRect(0, 0, W, H, PAPER);

  // Masthead: kicker kecil, hari, lalu tanggal satu baris penuh, huruf terbesar.
  drawTextCentered("THE WORLD TODAY", W / 2, 14, 4, INK_SOFT);
  drawTextCentered("WEDNESDAY", W / 2, 48, 5, INK);
  drawTextCentered("18 NOVEMBER 2026", W / 2, 90, 9, INK);
  fillRect(28, 162, W - 56, 5, RULE);
  fillRect(28, 171, W - 56, 2, RULE);

  // Cerita lead: peta Teluk lebar, headline 2 baris skala 7, ringkasan 2 baris.
  drawMotif(LEAD.motif, 28, 182, W - 56, 170, LEAD.palette);
  drawWrapped(LEAD.headline, 28, 364, 7, W - 56, 6, INK);
  drawWrapped(LEAD.summary, 28, 480, 4, W - 56, 5, INK_SOFT);
  fillRect(28, 556, W - 56, 3, RULE);

  // Dua panel pendukung berdampingan: jembatan patah | empat bendera Quad.
  const colW = 472;
  const panels: Story[] = [PANEL_LEFT, PANEL_RIGHT];
  const colX = [28, 28 + colW + 24];
  for (let i = 0; i < panels.length; i++) {
    const s = panels[i];
    const x = colX[i];
    drawMotif(s.motif, x, 568, colW, 80, s.palette);
    drawWrapped(s.headline, x, 656, 4, colW, 4, INK);
    drawWrapped(s.summary, x, 726, 4, colW, 4, INK_SOFT);
  }
  vline(28 + colW + 12, 568, 252, CARD_LINE);
  fillRect(28, 830, W - 56, 2, RULE);

  // Strip bawah Dhoni: kotak kuning nomor 7 + headline 1 baris + ringkasan.
  fillRect(28, 846, 120, 120, [249, 205, 5]);
  rectBorder(28, 846, 120, 120, INK, 3);
  drawText("7", 53, 857, 14, [31, 56, 100]);
  fillCircle(140, 956, 11, [255, 255, 255]);
  circleOutline(140, 956, 11, INK, 2);
  drawLine(132, 950, 148, 962, RED);
  drawWrapped(PANEL_STRIP.headline, 164, 852, 5, W - 164 - 28, 6, INK);
  drawWrapped(PANEL_STRIP.summary, 164, 900, 4, W - 164 - 28, 5, INK_SOFT);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  compose();
  const png = encodePNG(px, W, H);
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
