/**
 * Generates icon16.png, icon48.png, icon128.png for the Mouse Highlighter extension.
 * Pure Node.js — no npm packages needed.
 * Run: node generate-icons.js
 */

const zlib = require('zlib');
const fs   = require('fs');

// ── PNG encoder ───────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type), l = Buffer.alloc(4), crcB = Buffer.alloc(4);
  l.writeUInt32BE(data.length);
  crcB.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, crcB]);
}
function toPNG(w, h, px) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (w * 4 + 1) + 1 + x * 4;
      raw[d] = px[s]; raw[d+1] = px[s+1]; raw[d+2] = px[s+2]; raw[d+3] = px[s+3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Alpha compositing ─────────────────────────────────────────────────────
function blend(px, w, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= w || y >= w || a <= 0) return;
  const i = (y * w + x) * 4;
  const sa = Math.min(a, 255) / 255, da = px[i+3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa < 0.001) return;
  px[i]   = Math.round((r * sa + px[i]   * da * (1-sa)) / oa);
  px[i+1] = Math.round((g * sa + px[i+1] * da * (1-sa)) / oa);
  px[i+2] = Math.round((b * sa + px[i+2] * da * (1-sa)) / oa);
  px[i+3] = Math.round(oa * 255);
}

// ── Point-in-polygon ──────────────────────────────────────────────────────
function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside = !inside;
  }
  return inside;
}

// ── Icon renderer ─────────────────────────────────────────────────────────
function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const outerR  = size * 0.455;
  const ringW   = Math.max(2, size * 0.09);
  const innerR  = outerR - ringW;
  const glowMax = size * 0.07;

  // Background: dark navy circle, anti-aliased edge
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x+.5-cx, dy = y+.5-cy, d = Math.sqrt(dx*dx+dy*dy);
      if (d < outerR + 1) {
        const a = d > outerR ? Math.max(0, outerR + 1 - d) : 1;
        blend(pixels, size, x, y, 16, 14, 40, a * 255);
      }
    }
  }

  // Glow + ring (supersampled)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Glow
      const dx = x+.5-cx, dy = y+.5-cy, d = Math.sqrt(dx*dx+dy*dy);
      if (d > innerR - glowMax && d < outerR + glowMax) {
        const t  = 1 - Math.abs(d - (innerR + outerR) / 2) / (ringW / 2 + glowMax);
        const ga = Math.max(0, t * t * 0.45);
        blend(pixels, size, x, y, 255, 210, 0, ga * 255);
      }

      // Ring (4× supersampling)
      let cov = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const sdx = x + sx/4 + .125 - cx, sdy = y + sy/4 + .125 - cy;
          const sd  = Math.sqrt(sdx*sdx + sdy*sdy);
          if (sd >= innerR && sd <= outerR) cov++;
        }
      }
      if (cov > 0) blend(pixels, size, x, y, 255, 215, 0, (cov/16) * 255);
    }
  }

  // Cursor arrow (48px and 128px only)
  if (size >= 48) {
    // Arrow polygon defined for 128px, scaled proportionally
    const s = size / 128;
    const poly = [
      [ 0,  0], [ 0, 46], [13, 37],
      [21, 57], [30, 53], [22, 35], [38, 35]
    ].map(([x,y]) => [x*s + cx - 12*s, y*s + cy - 20*s]);

    const xs = poly.map(p=>p[0]), ys = poly.map(p=>p[1]);
    const x0=Math.floor(Math.min(...xs))-1, x1=Math.ceil(Math.max(...xs))+1;
    const y0=Math.floor(Math.min(...ys))-1, y1=Math.ceil(Math.max(...ys))+1;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // 4×4 supersample
        let fill = 0;
        for (let sy = 0; sy < 4; sy++)
          for (let sx = 0; sx < 4; sx++)
            if (inPoly(x + sx/4 + .125, y + sy/4 + .125, poly)) fill++;

        if (fill > 0) {
          // White body
          blend(pixels, size, x, y, 255, 255, 255, (fill/16) * 228);
        }
      }
    }

    // Dark outline (1px border around arrow)
    for (let y = y0-1; y <= y1+1; y++) {
      for (let x = x0-1; x <= x1+1; x++) {
        if (inPoly(x+.5, y+.5, poly)) continue; // skip interior
        let nearFill = false;
        for (const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
          if (inPoly(x+ox+.5, y+oy+.5, poly)) { nearFill = true; break; }
        }
        if (nearFill) blend(pixels, size, x, y, 0, 0, 0, 180);
      }
    }
  }

  return toPNG(size, size, pixels);
}

// ── Write files ───────────────────────────────────────────────────────────
if (!fs.existsSync('icons')) fs.mkdirSync('icons');
for (const size of [16, 48, 128]) {
  const file = `icons/icon${size}.png`;
  fs.writeFileSync(file, generateIcon(size));
  console.log(`✓ ${file}`);
}
console.log('Done.');
