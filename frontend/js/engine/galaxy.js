/* Nível 2 — Via Láctea (unidade: mil anos-luz).

   A galáxia é desenhada com ~95 mil partículas: disco com 4 braços em espiral
   logarítmica, bojo, barra central e halo. Os astros do catálogo são posicionados
   pelas coordenadas galácticas (l, b) e distância a partir do Sol; as estrelas
   com exoplanetas vêm do NASA Exoplanet Archive. */
import * as THREE from 'three';
import { Level } from './level.js';
import { TAU, D2R, clamp, rnd, gauss } from './util.js';
import { radialTex, dotTex, getGalTex } from './textures.js';
import { makeSky } from './sky.js';

const KK = Math.tan(12 * D2R), R0 = 2.5, RS = 26.1;
export const armTheta = (k, r) => (k * Math.PI) / 2 - Math.log(Math.max(r, R0) / R0) / KK;
const SUNPHI = armTheta(0, RS) + Math.PI / 4;
/* O Sol fica no Esporão de Órion, a 26,1 mil anos-luz do centro. */
export const SUNPOS = new THREE.Vector3(RS * Math.cos(SUNPHI), 0, RS * Math.sin(SUNPHI));
const UC = SUNPOS.clone().multiplyScalar(-1 / RS);
const VH = new THREE.Vector3(-SUNPOS.z, 0, SUNPOS.x).multiplyScalar(1 / RS);

/* Direção a partir do Sol para longitude l e latitude b galácticas (graus). */
export function galDir(l, b, out) {
  l *= D2R; b *= D2R;
  out.set(0, 0, 0).addScaledVector(UC, Math.cos(b) * Math.cos(l)).addScaledVector(VH, Math.cos(b) * Math.sin(l));
  out.y += Math.sin(b);
  return out;
}

function buildGalaxyGeometry() {
  const N = 64000 + 20000 + 9000 + 2500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
  let n = 0;
  const put = (x, y, z, c, s, k) => { pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; col[n * 3] = c[0] * k; col[n * 3 + 1] = c[1] * k; col[n * 3 + 2] = c[2] * k; siz[n] = s; n++; };
  for (let i = 0; i < 64000; i++) {            // disco e braços
    let r; do { r = -7.5 * Math.log(1 - rnd() * 0.999) + 3; } while (r > 46);
    const inArm = rnd() < 0.7; let th, young = false;
    if (inArm) { const k = (rnd() * 4) | 0; th = armTheta(k, r) + gauss() * clamp(2.3 / r, 0.07, 0.34); young = rnd() < 0.55; } else th = rnd() * TAU;
    const y = gauss() * (0.22 + 0.012 * r), c = young ? [0.62, 0.76, 1] : [1, 0.9, 0.7];
    const warm = clamp(1 - r / 30, 0, 1);
    if (!young) { c[1] = 0.8 + 0.12 * (1 - warm); c[2] = 0.5 + 0.25 * (1 - warm); }
    put(r * Math.cos(th), y, r * Math.sin(th), c, 0.14 + 0.25 * rnd(), young ? 0.52 : 0.4);
  }
  for (let i = 0; i < 20000; i++) {            // bojo
    const rr = Math.abs(gauss()) * 1.8, a = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
    put(rr * Math.sin(ph) * Math.cos(a) * 1.1, rr * Math.cos(ph) * 0.65, rr * Math.sin(ph) * Math.sin(a) * 1.1, [1, 0.78, 0.5], 0.12 + 0.2 * rnd(), 0.3);
  }
  const bar = 27 * D2R;                         // barra
  for (let i = 0; i < 9000; i++) { const a = gauss() * 2.4, b = gauss() * 0.65; put(a * Math.cos(bar) - b * Math.sin(bar), gauss() * 0.35, a * Math.sin(bar) + b * Math.cos(bar), [1, 0.78, 0.5], 0.12 + 0.2 * rnd(), 0.3); }
  for (let i = 0; i < 2500; i++) {             // halo
    const rr = 6 + Math.pow(rnd(), 0.8) * 28, a = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
    put(rr * Math.sin(ph) * Math.cos(a), rr * Math.cos(ph) * 0.8, rr * Math.sin(ph) * Math.sin(a), [0.8, 0.82, 1], 0.15 + 0.15 * rnd(), 0.38);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  return g;
}

export function galaxyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 }, uMin: { value: 1.6 }, uMax: { value: 26 }, uA: { value: 0.9 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aColor;attribute float aSize;uniform float uScale;uniform float uMin;uniform float uMax;uniform float uA;varying vec3 vC;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float s=length(modelMatrix[0].xyz);float px=aSize*s*uScale/max(-mv.z,1e-9);gl_PointSize=clamp(px,uMin,uMax);vC=aColor;vA=uA*clamp(px/uMin,.35,1.)*min(1.,uMax/max(px,.001));gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying vec3 vC;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float r=length(c)*2.;if(r>1.)discard;gl_FragColor=vec4(vC,exp(-r*r*3.2)*vA);}',
  });
}

export class GalaxyLevel extends Level {
  constructor(state) {
    super(2, 'Via Láctea', 700);
    this.state = state;
    this.exoPoints = null;
  }

  build({ bodies, exo }) {
    const sc = this.scene;
    this.group = new THREE.Group(); sc.add(this.group);
    this.geometry = buildGalaxyGeometry();
    this.material = galaxyMaterial();
    const pts = new THREE.Points(this.geometry, this.material); pts.frustumCulled = false; this.group.add(pts);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,225,170,.55)'], [0.12, 'rgba(255,210,150,.28)'], [0.45, 'rgba(120,150,255,.12)'], [1, 'rgba(80,100,200,0)']], 256), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.scale.setScalar(115); this.group.add(glow);

    const tagPts = [], tagCol = [];
    const v = new THREE.Vector3();
    const place = (body, pos, extra = {}) => {
      const node = new THREE.Object3D(); node.position.copy(pos); this.group.add(node);
      const r = body.render || {};
      if (extra.dot !== false) { tagPts.push(pos.x, pos.y, pos.z); const c = new THREE.Color(body.color || '#ffd27a'); tagCol.push(c.r, c.g, c.b); }
      return this.add({ id: body.slug, name: body.name, kind: body.kind, cat: body.category, col: body.color || undefined, node, getPos: o => node.getWorldPosition(o), view: r.view, minD: r.min ?? Math.min(1e-4, (r.view || 1) / 20), ...extra });
    };

    for (const body of bodies.filter(b => b.level === 2)) {
      const r = body.render || {};
      if (body.slug === 'sun2') place(body, SUNPOS, { prio: 100 });
      else if (r.origin) place(body, new THREE.Vector3(), { prio: 95, minD: r.min ?? 0.01 });
      else if (body.category === 'arm') {
        const th = armTheta(r.arm_k, r.arm_r);
        place(body, new THREE.Vector3(r.arm_r * Math.cos(th), 0, r.arm_r * Math.sin(th)), { prio: 30, minD: 0.5, arm: true, dot: false });
      } else if (r.l !== undefined) {
        galDir(r.l, r.b, v);
        const p = place(body, SUNPOS.clone().addScaledVector(v, r.d_ly / 1000), { prio: r.sprite ? 70 : 40, dot: !r.sprite, radius: () => (r.size ? r.size / 2 : 0) });
        if (r.sprite) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGalTex(r.sprite), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
          sp.scale.setScalar(r.size * 1.3); p.node.add(sp);
        }
      }
    }

    // Picks virtuais (só lista + card): a galáxia inteira e as estrelas com exoplanetas.
    const center = new THREE.Object3D(); this.group.add(center);
    for (const body of bodies.filter(b => b.level === 2 && b.render?.virtual)) {
      const r = body.render;
      const target = r.focus ? this.find(r.focus) : null;
      this.add({ id: body.slug, name: body.name, kind: body.kind, cat: body.category, virtual: true, getPos: target ? target.getPos : o => center.getWorldPosition(o), view: r.view, minD: target ? 0.01 : 1 });
    }

    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tagPts, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tagCol, 3));
    this.group.add(new THREE.Points(tg, new THREE.PointsMaterial({ size: 11, sizeAttenuation: false, vertexColors: true, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

    if (exo?.hosts?.length) this.buildExoplanets(exo.hosts);
    this.sky = makeSky(3500, 0.25);
  }

  /* Uma partícula por estrela com planeta confirmado: [l, b, distância em anos-luz, nº de planetas]. */
  buildExoplanets(hosts) {
    const pos = new Float32Array(hosts.length * 3), col = new Float32Array(hosts.length * 3), v = new THREE.Vector3();
    hosts.forEach(([l, b, d, n], i) => {
      galDir(l, b, v).multiplyScalar(d / 1000).add(SUNPOS);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const c = n > 1 ? [1, 0.62, 0.9] : [0.72, 0.6, 1];
      col[i * 3] = c[0] * 0.85; col[i * 3 + 1] = c[1] * 0.85; col[i * 3 + 2] = c[2] * 0.85;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.exoPoints = new THREE.Points(g, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.exoPoints.frustumCulled = false;
    this.group.add(this.exoPoints);
  }

  setExoVisible(v) {
    if (this.exoPoints) this.exoPoints.visible = v;
  }

  home() {
    return { pick: this.find('mw'), dist: 85 };
  }
}
