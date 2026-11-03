/* Céu de fundo: estrelas fixas numa esfera distante, com a faixa da Via Láctea
   orientada como a vemos da Terra. */
import * as THREE from 'three';
import { TAU, rnd, gauss } from './util.js';
import { dotTex, glowTex } from './textures.js';

export function makeSky(n, band) {
  const sc = new THREE.Scene(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const e1 = new THREE.Vector3(0, 0, 1), nn = new THREE.Vector3(-0.8677, 0.4971, 0);
  const e2 = new THREE.Vector3().crossVectors(nn, e1).normalize();
  const gc = new THREE.Vector3(-0.0555, -0.0976, 0.9936), a0 = Math.atan2(gc.dot(e2), gc.dot(e1));
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let bright = 0.25 + Math.pow(rnd(), 4) * 0.75;
    if (band && rnd() < band) {
      const a = rnd() < 0.35 ? a0 + gauss() * 0.9 : rnd() * TAU, b = gauss() * 0.11;
      v.set(0, 0, 0).addScaledVector(e1, Math.cos(a)).addScaledVector(e2, Math.sin(a)).addScaledVector(nn, b).normalize();
      bright *= 0.7;
    } else v.set(gauss(), gauss(), gauss()).normalize();
    pos[i * 3] = v.x * 50; pos[i * 3 + 1] = v.y * 50; pos[i * 3 + 2] = v.z * 50;
    const t = rnd(), c = t < 0.15 ? [0.7, 0.8, 1] : t < 0.7 ? [1, 0.97, 0.9] : [1, 0.8, 0.65];
    col[i * 3] = c[0] * bright; col[i * 3 + 1] = c[1] * bright; col[i * 3 + 2] = c[2] * bright;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sc.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, map: dotTex, transparent: true, depthWrite: false, alphaTest: 0.02 })));
  if (band) {
    const m = 400, p2 = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) {
      const a = rnd() < 0.4 ? a0 + gauss() * 0.8 : rnd() * TAU, b = gauss() * 0.1;
      v.set(0, 0, 0).addScaledVector(e1, Math.cos(a)).addScaledVector(e2, Math.sin(a)).addScaledVector(nn, b).normalize();
      p2[i * 3] = v.x * 50; p2[i * 3 + 1] = v.y * 50; p2[i * 3 + 2] = v.z * 50;
    }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    sc.add(new THREE.Points(g2, new THREE.PointsMaterial({ size: 70, sizeAttenuation: false, color: 0x4a5f9a, map: glowTex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })));
  }
  return sc;
}
