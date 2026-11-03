/* Utilidades matemáticas e constantes compartilhadas pelo motor 3D. */
export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;
export const AU_KM = 149597870.7;
export const J2000 = 2451545.0;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Gerador pseudoaleatório com semente: a galáxia e o céu ficam sempre iguais. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rnd = mulberry32(20261021);
export const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); };

export const fmt = (n, d = 1) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: d });
export const yieldUI = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

/* Datas julianas (o JPL entrega as épocas das órbitas nesse formato). */
export const jdNow = () => Date.now() / 86400000 + 2440587.5;
export const jdToDate = jd => new Date((jd - 2440587.5) * 86400000);

/* Cor de cada categoria de astro (lista, rótulos e card). */
export const CATCOL = {
  star: '#ffd27a', planet: '#79bfff', moon: '#c9d1e6', dwarf: '#d9a3ff', comet: '#a0d8ff',
  region: '#8fe0b0', probe: '#ff8f7a', neo: '#ffb070', bh: '#b8a2ff', cluster: '#9fc4ff',
  nebula: '#ff8fc0', arm: '#79bfff', galaxy: '#8fe0b0', exo: '#c9a0ff', spiral: '#79bfff',
  ell: '#ffd27a', irr: '#8fe0b0', struct: '#ff8fc0',
};
