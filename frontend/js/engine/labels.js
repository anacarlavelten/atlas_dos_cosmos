/* Rótulos HTML sobre a cena 3D: projeção na tela, anti-sobreposição, hover e clique.
   Fica fora do Vue de propósito: é atualizado a cada quadro (60x por segundo). */
import * as THREE from 'three';
import { CATCOL } from './util.js';

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();

export class LabelLayer {
  constructor(engine, container, tip) {
    this.engine = engine;
    this.container = container;
    this.tip = tip;
    this.hovered = null;
  }

  build(levels) {
    this.container.innerHTML = '';
    for (const lv of levels) {
      for (const o of lv.picks) {
        if (o.virtual || !o.getPos) continue;
        const e = document.createElement('div');
        e.className = 'lb';
        e.style.setProperty('--c', o.col || CATCOL[o.cat] || '#fff');
        const dot = document.createElement('i');
        const span = document.createElement('span');
        span.textContent = o.name;
        e.append(dot, span);
        o.el = e;
        o.tw = o.name.length * 6.6 + 20;
        this.container.appendChild(e);
      }
    }
  }

  /* Converte a posição 3D de cada astro em coordenadas de tela. */
  project(level, camera, ctlDist, fovTan) {
    const W = innerWidth, H = innerHeight, f = H / (2 * fovTan);
    _m.copy(camera.matrixWorld).invert();
    for (const o of level.picks) {
      if (!o.getPos || o.virtual || o.hidden) { o.vis = false; continue; }
      o.getPos(_v);
      _v.applyMatrix4(_m);
      const depth = -_v.z;
      if (depth <= 0) { o.vis = false; continue; }
      o.sx = (_v.x / depth) * f + W / 2;
      o.sy = (-_v.y / depth) * f + H / 2;
      o.rpx = (o.radius() * f) / depth;
      o.vis = o.sx > -30 && o.sx < W + 30 && o.sy > -30 && o.sy < H + 30;
      if (o.arm && ctlDist < 2) o.vis = false;
    }
    // Luas "coladas" no planeta somem até a câmera chegar perto.
    const selected = this.engine.selected;
    for (const o of level.picks) {
      if (o.parentPick && o.vis && o.parentPick.vis && o !== selected) {
        const d = Math.hypot(o.sx - o.parentPick.sx, o.sy - o.parentPick.sy);
        if (d < Math.max(14, o.parentPick.rpx * 1.05)) o.vis = false;
      }
    }
  }

  update(level, allLevels, showNames) {
    const selected = this.engine.selected, hovered = this.hovered;
    const cand = level.picks
      .filter(o => o.el && o.vis)
      .sort((a, b) => (b === selected) - (a === selected) || (b === hovered) - (a === hovered) || b.prio - a.prio);
    const placed = [];
    for (const o of cand) {
      let ok = showNames || o === selected || o === hovered;
      if (ok) {
        const r = { x: o.sx + 8, y: o.sy - 9, w: o.tw, h: 18 };
        for (const q of placed) {
          if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) { ok = false; break; }
        }
        if (ok || o === selected || o === hovered) { placed.push(r); ok = true; }
      }
      o._tx = ok;
      o.el.style.transform = `translate(${o.sx.toFixed(1)}px,${o.sy.toFixed(1)}px) translateY(-50%)`;
    }
    for (const o of level.picks) {
      if (!o.el) continue;
      const on = !!o.vis && !(o.arm && !showNames);
      o.el.classList.toggle('on', on);
      o.el.classList.toggle('tx', on && !!o._tx);
      o.el.classList.toggle('sel', o === selected);
      o.el.classList.toggle('hv', o === hovered);
    }
    for (const lv of allLevels) {
      if (lv === level) continue;
      for (const o of lv.picks) if (o.el) o.el.classList.remove('on', 'tx');
    }
  }

  pickAt(level, x, y, tol) {
    let best = null, bs = 1e9;
    for (const o of level.picks) {
      if (!o.vis || !o.el) continue;
      const d = Math.hypot(o.sx - x, o.sy - y), s = Math.max(0, d - Math.max(o.rpx, 0));
      if (s > tol) continue;
      const key = s * 1000 + Math.min(o.rpx, 500) - o.prio * 0.01;
      if (key < bs) { bs = key; best = o; }
    }
    return best;
  }

  setHover(o, x, y, canvas) {
    if (o !== this.hovered) { this.hovered = o; canvas.classList.toggle('hov', !!o); }
    if (o) {
      this.tip.replaceChildren();
      const b = document.createElement('b'); b.textContent = o.name;
      const s = document.createElement('span'); s.textContent = o.kind || '';
      this.tip.append(b, s);
      this.tip.style.opacity = 1;
      this.tip.style.left = Math.min(x + 16, innerWidth - 250) + 'px';
      this.tip.style.top = y + 16 + 'px';
    } else this.tip.style.opacity = 0;
  }
}
