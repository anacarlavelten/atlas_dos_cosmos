/* Nível 1 — Sistema Solar (unidade: UA).

   As posições vêm dos elementos orbitais entregues pela API (/api/orbits), que
   por sua vez vêm do JPL Horizons/SBDB. As luas orbitam o planeta com a órbita
   real (orientação e fase), mas com a distância ampliada junto com os tamanhos
   para continuarem visíveis. As sondas usam posição + velocidade do Horizons. */
import * as THREE from 'three';
import { Level, worldPos } from './level.js';
import { TAU, D2R, AU_KM, J2000, clamp, rnd, gauss, yieldUI } from './util.js';
import { getTex, glowTex, atmoMat } from './textures.js';
import { positionAt, orbitPoints, orbitLine, eclipticToScene } from './orbits.js';
import { makeSky } from './sky.js';

const SUN_R_AU = 695700 / AU_KM;
/* O Sol cresce menos que os planetas para não engolir Mercúrio. */
const sunScaleFor = s => Math.min(SUN_R_AU * Math.pow(s, 0.65), 0.17) / SUN_R_AU;

export class SolarLevel extends Level {
  constructor(state) {
    super(1, 'Sistema Solar', 700);
    this.state = state;
    this.bodies = {};      // astros com esfera (Sol, planetas, anões, luas)
    this.moons = [];
    this.comets = [];
    this.probes = [];
    this.neos = [];
    this.orbitLines = [];
    this.belts = [];
    this.tmp = new THREE.Vector3();
    this.tmpArr = [0, 0, 0];
  }

  mkBody(slug, r) {
    const node = new THREE.Object3D(), tilt = new THREE.Object3D();
    tilt.rotation.z = (r.tilt_deg || 0) * D2R;
    node.add(tilt);
    const mat = slug === 'sol'
      ? new THREE.MeshBasicMaterial({ map: getTex('sun') })
      : new THREE.MeshLambertMaterial({ map: getTex(r.texture), emissive: 0x0a0d18 });
    const mesh = new THREE.Mesh(this.sphere, mat);
    tilt.add(mesh);
    const b = { slug, R: r.radius_km, node, tilt, mesh, rotH: r.rotation_hours || 24, spin: rnd() * TAU, sc: 1 };
    if (r.atmosphere) {
      const [c, k, p] = r.atmosphere;
      b.atm = new THREE.Mesh(this.sphere, atmoMat(c, k, p));
      node.add(b.atm);
    }
    if (r.ring) b.ring = this.mkRing(r.ring, tilt);
    return b;
  }

  mkRing([ri, ro], parent) {
    const g = new THREE.RingGeometry(ri, ro, 160, 1), pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const rr = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (rr - ri) / (ro - ri), 0.5);
    }
    g.rotateX(-Math.PI / 2);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 2;
    const c = cv.getContext('2d');
    for (let x = 0; x < 512; x++) {
      const t = x / 512;
      let a = t < 0.1 ? 0.12 : t < 0.35 ? 0.4 : t < 0.4 ? 0.05 : t < 0.78 ? 0.85 : t < 0.82 ? 0.02 : 0.6;
      a *= 0.75 + 0.25 * Math.sin(x * 0.9) * Math.sin(x * 0.23);
      c.fillStyle = `rgba(${(210 + 30 * Math.sin(x * 0.1)) | 0},${(190 + 20 * Math.sin(x * 0.13)) | 0},150,${clamp(a, 0, 1)})`;
      c.fillRect(x, 0, 1, 2);
    }
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    parent.add(mesh);
    return mesh;
  }

  sphereView(b) {
    return {
      radius: () => (b.R / AU_KM) * b.sc,
      view: () => Math.max((b.R / AU_KM) * b.sc * 5.5, b.slug === 'sol' ? 0.4 : 1e-9),
      minD: () => (b.R / AU_KM) * b.sc * 1.7,
    };
  }

  async build({ bodies, orbits, neos }) {
    const sc = this.scene;
    this.sphere = new THREE.SphereGeometry(1, 64, 48);
    // Luzes: no Three.js atual a iluminação é física, por isso o fator π.
    sc.add(new THREE.AmbientLight(0x8090b0, 0.28 * Math.PI));
    sc.add(new THREE.PointLight(0xffffff, 1.5 * Math.PI, 0, 0));

    const orb = Object.fromEntries((orbits?.bodies || []).map(o => [o.slug, o]));
    const craft = Object.fromEntries((orbits?.spacecraft || []).map(o => [o.slug, o]));
    const mine = bodies.filter(b => b.level === 1);
    const meta = b => ({ id: b.slug, name: b.name, kind: b.kind, cat: b.category });

    for (const body of mine) {
      const r = body.render || {};
      const el = orb[body.slug]?.elements;
      switch (body.category) {
        case 'star': {
          const b = this.mkBody(body.slug, r);
          b.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
          b.node.add(b.glow);
          this.bodies[body.slug] = b; sc.add(b.node);
          this.add({ ...meta(body), getPos: worldPos(b.node), prio: 100, ...this.sphereView(b) });
          break;
        }
        case 'planet':
        case 'dwarf': {
          await yieldUI();
          const b = this.mkBody(body.slug, r);
          b.el = el;
          this.bodies[body.slug] = b; sc.add(b.node);
          if (el) {
            const line = orbitLine(el, new THREE.Color(r.orbit_color || '#6f88c8'), 0.4);
            sc.add(line); this.orbitLines.push(line);
          }
          this.add({ ...meta(body), getPos: worldPos(b.node), prio: body.category === 'planet' ? 90 : 60, ...this.sphereView(b) });
          break;
        }
        case 'comet': {
          if (!el) break;
          const node = new THREE.Object3D(); sc.add(node);
          const line = orbitLine(el, 0xa0d8ff, 0.3, 720); sc.add(line); this.orbitLines.push(line);
          this.comets.push({ node, el });
          this.add({ ...meta(body), getPos: worldPos(node), prio: 55, view: r.view || 3, minD: 0.05 });
          break;
        }
        case 'probe': {
          const st = craft[body.slug];
          if (!st) break;
          const node = new THREE.Object3D(); sc.add(node);
          this.probes.push({ node, st });
          this.add({ ...meta(body), getPos: worldPos(node), prio: 55, view: r.view || 60, minD: 0.05 });
          break;
        }
        case 'region': {
          const node = new THREE.Object3D();
          node.position.set(r.r_au * Math.cos(r.angle), 0, -r.r_au * Math.sin(r.angle));
          sc.add(node);
          this.add({ ...meta(body), getPos: worldPos(node), prio: 45, view: r.view, minD: 0.5 });
          break;
        }
        case 'neo':
          // Card explicativo do grupo; a câmera vai até a Terra.
          this.add({ ...meta(body), virtual: true, getPos: out => (this.bodies.terra ? this.bodies.terra.node.getWorldPosition(out) : out.set(1, 0, 0)), view: r.view || 0.35, minD: 0.01 });
          break;
      }
    }

    // Luas: depois dos planetas, porque ficam presas ao nó do planeta.
    for (const body of mine.filter(b => b.category === 'moon')) {
      const parent = this.bodies[body.parent], el = orb[body.slug]?.elements;
      if (!parent || !el) continue;
      const b = this.mkBody(body.slug, { ...body.render, tilt_deg: 0 });
      b.el = el; b.parent = parent;
      b.unitPts = orbitPoints(el, 128);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.unitPts.length), 3));
      b.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8fa0c8, transparent: true, opacity: 0.3, depthWrite: false }));
      b.line.frustumCulled = false;
      parent.node.add(b.node); parent.node.add(b.line);
      this.bodies[body.slug] = b; this.moons.push(b);
      this.add({ ...meta(body), getPos: worldPos(b.node), prio: 42, parentPick: this.find(body.parent), ...this.sphereView(b) });
    }

    sc.add(this.makeBelt(7000, 2.1, 3.3, 0.05, [0.75, 0.7, 0.62], 1.6, 0));
    sc.add(this.makeBelt(9000, 30, 50, 0.18, [0.6, 0.72, 0.85], 1.4, 1));
    this.setNeos(neos?.objects || []);
    this.sky = makeSky(5000, 0.55);
    this.applyScale();
  }

  /* Asteroides da semana (NeoWs): órbita + marcador clicável. */
  setNeos(list) {
    for (const n of list) {
      if (!n.elements) continue;
      const node = new THREE.Object3D(); this.scene.add(node);
      const line = orbitLine(n.elements, 0xffa060, 0.28, 240); this.scene.add(line);
      const pick = this.add({ id: `neo:${n.id}`, name: n.name, kind: n.hazardous ? 'Asteroide potencialmente perigoso' : 'Asteroide próximo da Terra', cat: 'neo', getPos: worldPos(node), prio: 35, view: 0.35, minD: 0.01 });
      this.neos.push({ node, el: n.elements, line, pick });
    }
  }

  makeBelt(n, r0, r1, hy, col, size, kind) {
    const R = new Float32Array(n), P = new Float32Array(n), Y = new Float32Array(n), Sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      R[i] = kind ? r0 + Math.pow(rnd(), 1.6) * (r1 - r0) * (rnd() < 0.12 ? 1.5 : 1) : r0 + (r1 - r0) * (0.5 + gauss() * 0.22);
      R[i] = Math.max(r0 * 0.95, R[i]); P[i] = rnd() * TAU; Y[i] = gauss() * hy * R[i] * 0.3; Sz[i] = size * (0.6 + rnd() * 0.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aR', new THREE.BufferAttribute(R, 1)); g.setAttribute('aP', new THREE.BufferAttribute(P, 1));
    g.setAttribute('aY', new THREE.BufferAttribute(Y, 1)); g.setAttribute('aS', new THREE.BufferAttribute(Sz, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uD: { value: 0 }, uC: { value: new THREE.Color(...col) }, uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      transparent: true, depthWrite: false,
      // Cada ponto gira com o período de Kepler da sua distância (T ∝ r^1,5).
      vertexShader: 'attribute float aR;attribute float aP;attribute float aY;attribute float aS;uniform float uD;uniform float uDpr;void main(){float a=aP+6.2831853*uD/(365.25*pow(aR,1.5));vec3 p=vec3(aR*cos(a),aY,-aR*sin(a));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=aS*uDpr;}',
      fragmentShader: 'uniform vec3 uC;void main(){vec2 c=gl_PointCoord-.5;if(length(c)>.5)discard;gl_FragColor=vec4(uC,.42);}',
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    this.belts.push(m);
    return pts;
  }

  applyScale() {
    const s = this.state.scaleS, sf = sunScaleFor(s);
    for (const b of Object.values(this.bodies)) {
      b.sc = b.slug === 'sol' ? sf : s;
      const r = (b.R / AU_KM) * b.sc;
      b.mesh.scale.setScalar(r);
      b.atm?.scale.setScalar(r * 1.12);
      b.ring?.scale.setScalar(r);
      b.glow?.scale.setScalar(r * 7);
    }
    const spread = Math.max(1, s * 0.5);
    for (const m of this.moons) {
      m.base = (m.parent.R / AU_KM) * m.parent.sc * 1.6;
      m.spread = spread;
      const pos = m.line.geometry.attributes.position, u = m.unitPts;
      for (let i = 0; i < pos.count; i++) {
        const x = u[i * 3], y = u[i * 3 + 1], z = u[i * 3 + 2], L = Math.hypot(x, y, z) || 1, k = (m.base + L * spread) / L;
        pos.setXYZ(i, x * k, y * k, z * k);
      }
      pos.needsUpdate = true;
      m.line.geometry.computeBoundingSphere();
    }
  }

  setOrbitsVisible(v) {
    this.orbitLines.forEach(l => (l.visible = v));
    this.moons.forEach(m => (m.line.visible = v));
  }

  setNeosVisible(v) {
    for (const n of this.neos) { n.line.visible = v; n.pick.hidden = !v; }
  }

  update(dt, jd) {
    const v = this.tmp, st = this.state;
    for (const b of Object.values(this.bodies)) {
      if (b.el && !b.parent) b.node.position.copy(positionAt(b.el, jd, v));
    }
    for (const c of this.comets) positionAt(c.el, jd, c.node.position);
    for (const m of this.moons) {
      positionAt(m.el, jd, v);
      const L = v.length() || 1;
      m.node.position.copy(v).multiplyScalar((m.base + L * m.spread) / L);
    }
    for (const p of this.probes) {
      const s = p.st, d = jd - s.epoch_jd, a = this.tmpArr;
      for (let k = 0; k < 3; k++) a[k] = s.position[k] + s.velocity[k] * d;
      eclipticToScene(a, p.node.position);
    }
    for (const n of this.neos) positionAt(n.el, jd, n.node.position);

    for (const b of Object.values(this.bodies)) {
      const w = TAU / (b.rotH / 24);
      const step = clamp(w * dt * st.sp[1] * st.dir, -1.3 * dt, 1.3 * dt);
      if (st.playing) b.spin += step;
      b.mesh.rotation.y = b.spin;
    }
    for (const m of this.belts) m.uniforms.uD.value = jd - J2000;
  }

  home() {
    return { pick: this.find('sol'), dist: 38 };
  }
}
