/* Texturas procedurais: superfícies dos planetas e luas, brilhos e galáxias.
   Tudo é desenhado em <canvas> com ruído, sem baixar imagens. */
import * as THREE from 'three';
import { TAU, mulberry32, gauss } from './util.js';

function h3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967295;
}
function vn(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm(x, y, z, o) { let a = 0, m = 0.5, f = 1, s = 0; for (let i = 0; i < o; i++) { a += m * vn(x * f, y * f, z * f); s += m; m *= 0.5; f *= 2.03; } return a / s; }
const mix = (a, b, t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
const sat = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function rock(base, hi, f, seed, cap) {
  return (x, y, z) => {
    const n = fbm(x * f + seed, y * f, z * f, 5), m = fbm(x * f * 3 + seed, y * f * 3, z * f * 3, 3);
    let c = mix(base, hi, n * 1.2 - 0.1 + (m - 0.5) * 0.4);
    if (cap && Math.abs(y) > cap) c = mix(c, [238, 240, 244], (Math.abs(y) - cap) * 14);
    return c;
  };
}
function bands(pal, f, turb, seed, spot) {
  return (x, y, z) => {
    const t = (fbm(x * 2.2 + seed, y * 5, z * 2.2, 4) - 0.5) * turb;
    const v = y * f + t;
    const k = Math.sin(v * 3.1) * 0.5 + 0.5;
    const k2 = fbm(x * 1.5, y * 20 + seed, z * 1.5, 3);
    let c = mix(mix(pal[0], pal[1], k), pal[2], k2 * 0.7 * (Math.sin(v * 7) * 0.5 + 0.5));
    if (spot) {
      const dx = Math.atan2(z, x) - spot.lon, dy = Math.asin(y) - spot.lat;
      const q = (dx * dx) / 0.05 + (dy * dy) / 0.012;
      if (q < 1) c = mix(c, spot.col, (1 - q) * 0.9);
    }
    return c;
  };
}

const TEXFN = {
  sun: (x, y, z) => { const n = fbm(x * 5 + 3, y * 5, z * 5, 4), m = fbm(x * 16, y * 16, z * 16 + 9, 3); return mix([255, 140, 20], [255, 236, 150], (0.55 * n + 0.45 * m) * 1.35 - 0.15); },
  earth: (x, y, z) => {
    const n = fbm(x * 1.8 + 7, y * 1.8, z * 1.8, 5), ay = Math.abs(y); let c;
    if (ay > 0.9) c = [238, 244, 250];
    else if (n > 0.52) {
      const m = fbm(x * 4 + 1, y * 4, z * 4, 3);
      c = mix([48, 112, 54], [150, 122, 76], sat((m - 0.35) * 2.2));
      if (ay < 0.3 && m < 0.45) c = mix(c, [200, 172, 100], 0.6);
      if (ay > 0.72) c = mix(c, [228, 234, 238], (ay - 0.72) / 0.18);
    } else c = mix([44, 116, 190], [9, 34, 92], sat((0.52 - n) * 5));
    const cl = fbm(x * 3 + 20, y * 5, z * 3, 4);
    return mix(c, [255, 255, 255], sat((cl - 0.54) * 3.2) * 0.85);
  },
  mars: (x, y, z) => { const n = fbm(x * 2.5 + 2, y * 2.5, z * 2.5, 5); let c = mix([118, 58, 36], [208, 128, 82], n); const d = fbm(x * 5 + 9, y * 5, z * 5, 3); if (d < 0.38) c = mix(c, [66, 38, 30], 0.55); if (Math.abs(y) > 0.93) c = [242, 240, 236]; return c; },
  venus: (x, y, z) => mix([196, 150, 92], [248, 228, 176], fbm(x * 1.2, y * 3.6, z * 1.2, 4) * 1.3 - 0.1),
  mercury: rock([110, 104, 98], [176, 168, 158], 3, 1),
  moon: rock([96, 94, 92], [190, 188, 184], 3, 5),
  ceres: rock([96, 94, 92], [160, 156, 150], 3, 9),
  phobos: rock([92, 80, 70], [150, 134, 118], 4, 13),
  deimos: rock([120, 106, 92], [176, 160, 140], 3, 17),
  pluto: (x, y, z) => { const n = fbm(x * 3 + 4, y * 3, z * 3, 5); let c = mix([150, 110, 82], [226, 204, 176], n * 1.3); const dx = Math.atan2(z, x) - 1.2, dy = Math.asin(y) - 0.1; if ((dx * dx) / 0.4 + (dy * dy) / 0.25 < 1) c = mix(c, [244, 232, 214], 0.7); return c; },
  jupiter: bands([[228, 198, 152], [168, 108, 70], [244, 230, 206]], 9, 1.2, 3, { lon: 2.2, lat: -0.38, col: [190, 80, 52] }),
  saturn: bands([[232, 212, 168], [204, 176, 124], [242, 230, 200]], 8, 0.6, 7),
  uranus: bands([[168, 224, 228], [150, 208, 218], [190, 236, 238]], 6, 0.25, 11),
  neptune: bands([[58, 98, 208], [44, 76, 176], [110, 146, 236]], 7, 0.5, 13, { lon: 4.2, lat: -0.3, col: [20, 34, 96] }),
  io: (x, y, z) => { const n = fbm(x * 3 + 4, y * 3, z * 3, 5); let c = mix([214, 188, 76], [240, 220, 120], n); const d = fbm(x * 8, y * 8, z * 8 + 3, 3); if (d < 0.35) c = mix(c, [96, 56, 38], 0.7); if (d > 0.7) c = mix(c, [212, 100, 46], 0.5); return c; },
  europa: (x, y, z) => { let c = mix([224, 216, 200], [246, 242, 234], fbm(x * 3, y * 3, z * 3, 4)); const r = Math.abs(fbm(x * 5 + 2, y * 5, z * 5, 3) - 0.5); if (r < 0.03) c = mix(c, [170, 112, 84], 0.7); const r2 = Math.abs(fbm(x * 9, y * 9 + 4, z * 9, 3) - 0.5); if (r2 < 0.02) c = mix(c, [160, 104, 80], 0.5); return c; },
  ganymede: (x, y, z) => { const n = fbm(x * 3 + 6, y * 3, z * 3, 5); let c = mix([108, 96, 84], [176, 168, 156], n); if (fbm(x * 7, y * 7, z * 7, 3) > 0.62) c = mix(c, [210, 204, 196], 0.6); return c; },
  callisto: rock([60, 54, 50], [118, 108, 98], 4, 2),
  titan: (x, y, z) => mix([196, 132, 52], [224, 172, 84], fbm(x * 2, y * 4, z * 2, 3)),
  triton: (x, y, z) => mix([220, 206, 200], [244, 226, 222], fbm(x * 3, y * 3, z * 3, 4)),
  charon: (x, y, z) => { let c = mix([118, 114, 112], [178, 172, 168], fbm(x * 3, y * 3, z * 3, 4)); if (y > 0.8) c = mix(c, [130, 72, 60], (y - 0.8) * 4); return c; },
};
const CRATER = { mercury: 140, moon: 160, ceres: 70, callisto: 240, ganymede: 80, phobos: 60, deimos: 30 };
const texCache = {};

export function getTex(name) {
  if (texCache[name]) return texCache[name];
  const fn = TEXFN[name] || TEXFN.moon;
  const W = 384, H = 192, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, y = Math.sin(lat), cr = Math.cos(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * TAU, c = fn(cr * Math.cos(lon), y, cr * Math.sin(lon)), k = (j * W + i) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const nc = CRATER[name];
  if (nc) {
    const r = mulberry32(name.length * 31);
    for (let i = 0; i < nc; i++) {
      const x = r() * W, y = H * 0.12 + r() * H * 0.76, rad = 1.5 + Math.pow(r(), 3) * 14;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(0.75, 'rgba(0,0,0,.12)');
      gr.addColorStop(0.9, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
  return (texCache[name] = t);
}

export function radialTex(stops, S = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}
export const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,240,200,.75)'], [0.4, 'rgba(255,190,100,.22)'], [1, 'rgba(255,150,60,0)']], 256);
export const dotTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']], 32);

/* Sprites das galáxias (espiral, elíptica, irregular, anel, de perfil...). */
function galTex(kind) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'); g.translate(S / 2, S / 2); const r = mulberry32(kind.length * 997 + 5);
  const glow = (rad, col, a) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S); };
  g.globalCompositeOperation = 'lighter';
  if (kind === 'spiral') {
    glow(118, '110,140,255', 0.28); glow(50, '255,226,170', 0.6);
    for (let a = 0; a < 2; a++) for (let i = 0; i < 1500; i++) {
      const t = r(), rr = 14 + t * 104, th = a * Math.PI + Math.log(rr / 14) / 0.34 + (r() - 0.5) * 0.5 * (1.15 - t);
      g.fillStyle = `rgba(${t < 0.4 ? '255,232,190' : '170,200,255'},${0.15 + 0.4 * r()})`; g.fillRect(rr * Math.cos(th), rr * Math.sin(th), 1.7, 1.7);
    }
    glow(16, '255,246,222', 1);
  } else if (kind === 'elliptical') { glow(120, '255,196,140', 0.4); glow(70, '255,214,160', 0.6); glow(26, '255,240,210', 1); }
  else if (kind === 'irregular') {
    glow(110, '120,170,255', 0.12);
    for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 150, y = (r() - 0.5) * 110, gr = g.createRadialGradient(x, y, 0, x, y, 10 + r() * 26); gr.addColorStop(0, 'rgba(170,205,255,.45)'); gr.addColorStop(1, 'rgba(170,205,255,0)'); g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80); }
    glow(20, '255,240,220', 0.5);
  } else if (kind === 'ring') {
    glow(120, '120,160,255', 0.08); g.shadowColor = 'rgba(110,170,255,.9)'; g.shadowBlur = 14; g.strokeStyle = 'rgba(150,195,255,.75)'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 84, 0, TAU); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,190,150,.5)'; g.beginPath(); g.arc(0, 0, 38, 0, TAU); g.stroke(); g.shadowBlur = 0; glow(30, '255,220,170', 0.85);
  } else if (kind === 'edge') {
    g.save(); g.scale(1, 0.28); glow(124, '255,222,170', 0.7); glow(64, '255,236,200', 0.8); g.restore(); glow(36, '255,240,210', 0.7);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(18,10,6,.8)'; g.fillRect(-110, -2.5, 220, 5); g.fillStyle = 'rgba(18,10,6,.4)'; g.fillRect(-100, -6, 200, 12);
  } else if (kind === 'cluster') {
    glow(120, '255,210,150', 0.18);
    for (let i = 0; i < 130; i++) { const a = r() * TAU, rr = Math.abs(gauss()) * 40; g.fillStyle = `rgba(255,${(200 + r() * 50) | 0},${(150 + r() * 60) | 0},${0.5 + 0.5 * r()})`; g.fillRect(rr * Math.cos(a), rr * Math.sin(a), 2.5, 2.5); }
    glow(22, '255,230,190', 0.6);
  } else if (kind === 'attractor') { glow(128, '255,120,190', 0.35); glow(70, '255,170,220', 0.3); }
  return new THREE.CanvasTexture(cv);
}
const galTexCache = {};
export const getGalTex = k => galTexCache[k] || (galTexCache[k] = galTex(k));

/* Material de atmosfera: brilho na borda do planeta (efeito Fresnel). */
export function atmoMat(col, k, p) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(col) }, k: { value: k }, p: { value: p } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 c;uniform float k;uniform float p;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.0-abs(dot(vN,vV)),p);gl_FragColor=vec4(c,f*k);}',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
}
