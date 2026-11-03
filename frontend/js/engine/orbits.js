/* Mecânica orbital: posição de um astro a partir dos elementos orbitais do JPL.

   elementos = { epoch_jd, a (UA), e, i (°), om = Ω (°), w = ω (°), ma = M na época (°), n (°/dia) }

   1. anomalia média na data:  M = ma + n · (jd − época)
   2. equação de Kepler:       M = E − e·sen E   (resolvida por Newton-Raphson)
   3. posição no plano da órbita e rotação por ω, i, Ω para a eclíptica.

   Eixos: a eclíptica (x, y) vira o plano horizontal da cena; o norte da
   eclíptica (z) aponta para cima (eixo y do Three.js). */
import * as THREE from 'three';
import { TAU, D2R } from './util.js';

export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

export function meanAnomaly(el, jd) {
  const M = (el.ma + el.n * (jd - el.epoch_jd)) * D2R;
  return ((M % TAU) + TAU) % TAU;
}

/* Posição (em UA, coordenadas da cena) para uma anomalia excêntrica E. */
export function positionFromE(el, E, out) {
  const w = el.w * D2R, Om = el.om * D2R, inc = el.i * D2R, a = el.a, e = el.e;
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(inc), si = Math.sin(inc);
  const x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  const y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  const z = sw * si * xp + cw * si * yp;
  return out.set(x, z, -y);
}

export function positionAt(el, jd, out) {
  return positionFromE(el, solveKepler(meanAnomaly(el, jd), el.e), out);
}

/* Converte um vetor eclíptico (x, y, z) do JPL para os eixos da cena. */
export const eclipticToScene = (v, out) => out.set(v[0], v[2], -v[1]);

/* Pontos da elipse completa (para desenhar a linha da órbita). */
export function orbitPoints(el, N = 360) {
  const pts = new Float32Array((N + 1) * 3), v = new THREE.Vector3();
  for (let k = 0; k <= N; k++) {
    positionFromE(el, (k / N) * TAU, v);
    pts[k * 3] = v.x; pts[k * 3 + 1] = v.y; pts[k * 3 + 2] = v.z;
  }
  return pts;
}

export function orbitLine(el, color, opacity, N = 360) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(orbitPoints(el, N), 3));
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  line.frustumCulled = false;
  return line;
}
