/* Nível 3 — Universo (unidade: milhões de anos-luz).

   A Via Láctea reaproveita as partículas do nível 2 em miniatura. As outras
   galáxias são sprites posicionados por (l, b, distância). Os pontos de fundo são
   ilustrativos, só para dar ideia de que existem bilhões de galáxias. */
import * as THREE from 'three';
import { Level } from './level.js';
import { TAU, rnd, gauss } from './util.js';
import { radialTex, dotTex, getGalTex } from './textures.js';
import { galDir } from './galaxy.js';

export class UniverseLevel extends Level {
  constructor(state) {
    super(3, 'Universo', 1700);
    this.state = state;
    this.sprites = [];
  }

  build({ bodies }, galaxy) {
    const sc = this.scene;
    this.mwGroup = new THREE.Group(); this.mwGroup.scale.setScalar(0.001); sc.add(this.mwGroup);
    this.material = galaxy.material.clone(); this.material.uniforms.uA.value = 0.07;
    const mp = new THREE.Points(galaxy.geometry, this.material); mp.frustumCulled = false; this.mwGroup.add(mp);
    const mwGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,230,190,.9)'], [0.2, 'rgba(160,180,255,.35)'], [1, 'rgba(100,120,220,0)']], 128), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    mwGlow.userData = { real: 0.11, fixed: false, rot: 0 }; sc.add(mwGlow); this.sprites.push(mwGlow);

    const v = new THREE.Vector3();
    for (const body of bodies.filter(b => b.level === 3)) {
      const r = body.render || {};
      const meta = { id: body.slug, name: body.name, kind: body.kind, cat: body.category, col: body.color || undefined };
      if (r.descend) {
        this.add({ ...meta, getPos: o => o.set(0, 0, 0), radius: () => 0.05, prio: 100, view: r.view, minD: r.min, descend: true });
      } else if (r.virtual) {
        this.add({ ...meta, virtual: true, nofly: true });
      } else if (r.tex) {
        const P = galDir(r.l, r.b, v).clone().multiplyScalar(r.d_mly);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGalTex(r.tex), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, rotation: r.tex === 'spiral' ? rnd() * TAU : 0 }));
        sp.position.copy(P);
        sp.userData = { real: r.size, rot: r.rot || 0, fixed: !!r.fixed, tex: r.tex };
        sc.add(sp); this.sprites.push(sp);
        this.add({ ...meta, getPos: o => o.copy(P), radius: () => sp.scale.x * 0.5, prio: body.category === 'struct' ? 55 : 70, view: () => Math.max(r.size * 2.6, 0.08), minD: () => Math.max(r.size * 0.5, 0.01) });
      } else if (r.l !== undefined) {
        const P = galDir(r.l, r.b, v).clone().multiplyScalar(r.d_mly);
        this.add({ ...meta, getPos: o => o.copy(P), prio: 48, view: r.view, minD: r.min });
      }
    }

    // Galáxias de fundo (ilustrativas), agrupadas em aglomerados.
    const N = 5200, bp = new Float32Array(N * 3), bc = new Float32Array(N * 3), cent = [];
    for (let i = 0; i < 70; i++) { v.set(gauss(), gauss() * 0.6, gauss()).normalize().multiplyScalar(80 + Math.pow(rnd(), 0.8) * 1100); cent.push(v.clone()); }
    for (let i = 0; i < N; i++) {
      if (rnd() < 0.72) { const c = cent[(rnd() * cent.length) | 0]; v.set(gauss(), gauss(), gauss()).multiplyScalar(14 + rnd() * 30).add(c); }
      else v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(30 + rnd() * 1200);
      bp[i * 3] = v.x; bp[i * 3 + 1] = v.y; bp[i * 3 + 2] = v.z;
      const t = rnd(), c = t < 0.5 ? [0.7, 0.8, 1] : [1, 0.86, 0.7], k = 0.35 + rnd() * 0.5;
      bc[i * 3] = c[0] * k; bc[i * 3 + 1] = c[1] * k; bc[i * 3 + 2] = c[2] * k;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    sc.add(new THREE.Points(bg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  /* Galáxias nunca ficam menores que alguns pixels, para continuarem visíveis. */
  updateSprites(dt, camera, viewportHeight, fovTan) {
    const px = (2 * fovTan) / viewportHeight;
    for (const sp of this.sprites) {
      const dist = sp.position.distanceTo(camera.position), u = sp.userData;
      const minS = dist * px * (u.fixed ? 60 : 26), sz = Math.max(u.real, minS), k = u.tex === 'edge' ? 1.5 : 1;
      sp.scale.set(sz * k, sz * k, 1);
      if (this.state.playing) sp.material.rotation += u.rot * 0.06 * dt * this.state.dir;
    }
  }

  home() {
    return { pick: this.find('mw3'), dist: 12 };
  }
}
