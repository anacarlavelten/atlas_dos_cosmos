/* Motor 3D do Atlas do Cosmos.

   createEngine() recebe os dados já carregados da API e os elementos do DOM,
   monta os três níveis e devolve um objeto com métodos que a interface (Vue)
   chama: select, goLevel, togglePlay, setSpeedSlider... Os acontecimentos da cena
   (clique num astro, troca de nível, texto do HUD) voltam para a interface pelos
   callbacks em `on`. */
import './setup.js';
import * as THREE from 'three';
import { D2R, clamp, lerp, ease, fmt, jdNow, jdToDate, yieldUI } from './util.js';
import { SolarLevel } from './solar.js';
import { GalaxyLevel } from './galaxy.js';
import { UniverseLevel } from './universe.js';
import { LabelLayer } from './labels.js';

const FOV = 50;
const FOVT = Math.tan((FOV / 2) * D2R);
const L1MIN = 1 / 24, L1MAX = 36525, L2MIN = 0.2, L2MAX = 200;
const HINTS = { 1: 'Continue afastando para sair do Sistema Solar', 2: 'Continue afastando para ver outras galáxias', 3: '' };

class Engine {
  constructor({ canvas, labelsEl, tipEl, fadeEl, on }) {
    this.canvas = canvas;
    this.fadeEl = fadeEl;
    this.on = on || {};
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x010207, 1);
    this.renderer.autoClear = false;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1e-6, 1e6);
    this.skyCam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

    this.state = {
      level: 1, jd: jdNow(), playing: true, dir: 1,
      sp: { 1: 10, 2: 8 },          // nível 1: dias por segundo; nível 2: milhões de anos por segundo
      scaleS: 60, labels: true, galAngle: 0,
    };
    this.ctl = { target: new THREE.Vector3(), dist: 50, dT: 50, yaw: 0.6, pitch: 0.5, focus: null, fly: null, min: 1e-6, max: 700, over: 0, under: 0 };
    this.selected = null;
    this.switching = false;
    this.labels = new LabelLayer(this, labelsEl, tipEl);
    this.tmp = new THREE.Vector3();
    this.hudT = 0;
    this.active = true;
  }

  async build(data, progress) {
    progress?.('Montando o Sistema Solar…');
    this.solar = new SolarLevel(this.state);
    await this.solar.build(data);
    await yieldUI();
    progress?.('Desenhando a Via Láctea…');
    this.galaxy = new GalaxyLevel(this.state);
    this.galaxy.build(data);
    await yieldUI();
    progress?.('Espalhando as galáxias…');
    this.universe = new UniverseLevel(this.state);
    this.universe.build(data, this.galaxy);
    this.levels = { 1: this.solar, 2: this.galaxy, 3: this.universe };
    this.labels.build(Object.values(this.levels));
    this.bindInput();
    addEventListener('resize', () => this.resize());
    this.resize();
    const h = this.solar.home();
    this.setView(h.pick, 60);
    this.ctl.pitch = 0.5; this.ctl.yaw = 0.5;
    this.flyTo(h.pick, h.dist, 2.5);
  }

  get level() { return this.levels[this.state.level]; }

  /* ===================== CÂMERA ===================== */
  minDistFor(o) {
    if (!o || o.minD === undefined) return 1e-6;
    return typeof o.minD === 'function' ? o.minD() : o.minD;
  }
  viewFor(o) { return typeof o.view === 'function' ? o.view() : o.view; }

  flyTo(o, dist, dur = 1.8) {
    if (!o?.getPos) return;
    this.ctl.focus = o;
    this.ctl.fly = { t: 0, dur, from: this.ctl.target.clone(), ld0: Math.log(this.ctl.dist), ld1: Math.log(Math.max(dist, this.minDistFor(o))) };
  }
  setView(o, dist) {
    this.ctl.focus = o; this.ctl.fly = null;
    o.getPos(this.ctl.target);
    this.ctl.dist = this.ctl.dT = dist;
  }

  updateCamera(dt) {
    const ctl = this.ctl, lv = this.level, p = this.tmp;
    ctl.max = lv.max;
    ctl.min = ctl.focus ? this.minDistFor(ctl.focus) : 1e-6;
    if (ctl.focus) ctl.focus.getPos(p);
    if (ctl.fly) {
      const f = ctl.fly; f.t += dt / f.dur;
      const e = ease(clamp(f.t, 0, 1));
      ctl.target.copy(f.from).lerp(p, e);
      ctl.dist = Math.exp(lerp(f.ld0, f.ld1, e)); ctl.dT = ctl.dist;
      if (f.t >= 1) ctl.fly = null;
    } else {
      if (ctl.focus) ctl.target.copy(p);
      const ld = Math.log(ctl.dist), lt = Math.log(clamp(ctl.dT, ctl.min, ctl.max * 1.0001));
      ctl.dist = Math.exp(lerp(ld, lt, 1 - Math.exp(-dt * 11)));
    }
    ctl.pitch = clamp(ctl.pitch, -1.5, 1.5);
    const cp = Math.cos(ctl.pitch), cam = this.camera;
    cam.position.set(ctl.target.x + Math.sin(ctl.yaw) * cp * ctl.dist, ctl.target.y + Math.sin(ctl.pitch) * ctl.dist, ctl.target.z + Math.cos(ctl.yaw) * cp * ctl.dist);
    cam.near = Math.max(ctl.dist * 0.002, 1e-11);
    cam.far = Math.max(ctl.dist * 2e5, lv.max * 3);
    cam.up.set(0, 1, 0); cam.lookAt(ctl.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    this.skyCam.quaternion.copy(cam.quaternion);
  }

  /* Zoom; afastar além do limite sobe de nível, aproximar do Sol/Via Láctea desce. */
  zoomBy(f) {
    const ctl = this.ctl, st = this.state;
    ctl.fly = null;
    ctl.dT = clamp(ctl.dT * f, ctl.min, ctl.max * 1.15);
    if (f > 1 && ctl.dT > ctl.max * 1.02) {
      ctl.over += Math.log(f);
      if (ctl.over > 0.8 && st.level < 3) { ctl.over = 0; this.goLevel(st.level + 1, 'up'); }
    } else if (f > 1) ctl.over = 0;
    if (f < 1) {
      ctl.over = 0;
      const o = ctl.focus;
      const descend = o && ctl.dT <= ctl.min * 1.1 && ((st.level === 2 && o.id === 'sun2') || (st.level === 3 && o.descend));
      if (descend) {
        ctl.under += Math.log(1 / f);
        if (ctl.under > 0.6) { ctl.under = 0; this.goLevel(st.level - 1, 'down'); }
      } else ctl.under = 0;
    }
  }

  /* ===================== SELEÇÃO ===================== */
  select(id, { fly = true } = {}) {
    const o = id ? this.level.find(id) : null;
    this.selected = o;
    this.on.select?.(o ? o.id : null);
    if (o && fly && o.getPos && !o.nofly) this.flyTo(o, this.viewFor(o), 1.7);
  }

  /* ===================== NÍVEIS ===================== */
  goLevel(n, how = 'tab') {
    const st = this.state;
    if (this.switching || n === st.level || n < 1 || n > 3) return;
    this.switching = true;
    const from = st.level;
    this.fadeEl.classList.add('on');
    setTimeout(() => {
      st.level = n;
      this.selected = null;
      this.on.select?.(null);
      this.labels.setHover(null, 0, 0, this.canvas);
      const h = this.levels[n].home();
      if (how === 'up' || how === 'down') {
        if (n === 2 && from === 1) { this.setView(this.galaxy.find('sun2'), 4e-5); this.ctl.pitch = 0.35; this.flyTo(h.pick, h.dist, 4.2); }
        else if (n === 3 && from === 2) { this.setView(h.pick, 0.07); this.flyTo(h.pick, h.dist, 4); }
        else if (n === 1) { this.setView(h.pick, 500); this.flyTo(h.pick, h.dist, 3.2); }
        else if (n === 2 && from === 3) { this.setView(h.pick, 400); this.flyTo(h.pick, h.dist, 3); }
      } else { this.setView(h.pick, h.dist); this.ctl.pitch = 0.45; }
      this.ctl.under = this.ctl.over = 0;
      this.on.level?.(n);
      setTimeout(() => { this.fadeEl.classList.remove('on'); this.switching = false; }, 120);
    }, 470);
  }

  /* ===================== TEMPO E ESCALA ===================== */
  speedSliderValue() {
    const st = this.state;
    if (st.level === 1) return (Math.log(st.sp[1] / L1MIN) / Math.log(L1MAX / L1MIN)) * 1000;
    return (Math.log(st.sp[2] / L2MIN) / Math.log(L2MAX / L2MIN)) * 1000;
  }
  setSpeedSlider(v) {
    const st = this.state;
    if (st.level === 1) st.sp[1] = L1MIN * Math.pow(L1MAX / L1MIN, v / 1000);
    else st.sp[2] = L2MIN * Math.pow(L2MAX / L2MIN, v / 1000);
    return this.speedLabel();
  }
  speedLabel() {
    const st = this.state;
    if (st.level === 1) {
      const d = st.sp[1];
      if (d < 1) return fmt(d * 24, 0) + ' h/s';
      if (d < 30) return fmt(d, d < 10 ? 1 : 0) + ' dia' + (d >= 2 ? 's' : '') + '/s';
      if (d < 365) return fmt(d / 30.44, 1) + ' meses/s';
      return fmt(d / 365.25, d > 3650 ? 0 : 1) + ' anos/s';
    }
    const m = st.sp[2];
    return fmt(m, m < 10 ? 1 : 0) + ' mi anos/s';
  }
  togglePlay() { this.state.playing = !this.state.playing; this.emitState(); return this.state.playing; }
  reverse() { this.state.dir *= -1; this.emitState(); return this.state.dir; }
  today() { this.state.jd = jdNow(); this.state.dir = 1; this.emitState(); }
  emitState() { this.on.state?.({ playing: this.state.playing, dir: this.state.dir }); }

  scaleSliderValue() { return Math.round((Math.log(this.state.scaleS) / Math.log(400)) * 100); }
  setScaleSlider(v) {
    this.state.scaleS = Math.max(1, Math.round(Math.pow(400, v / 100)));
    this.solar.applyScale();
    return this.scaleLabel();
  }
  scaleLabel() { return this.state.scaleS === 1 ? 'real (×1)' : '×' + this.state.scaleS; }

  setShowOrbits(v) { this.solar.setOrbitsVisible(v); }
  setShowNames(v) { this.state.labels = v; }
  setShowNeos(v) { this.solar.setNeosVisible(v); }
  setShowExo(v) { this.galaxy.setExoVisible(v); }

  /* ===================== HUD ===================== */
  hud() {
    const d = this.ctl.dist, lv = this.state.level;
    let dist;
    if (lv === 1) {
      const km = d * 149597870.7;
      dist = d < 0.02 ? fmt(km, km > 1e4 ? 0 : 1) + ' km' : fmt(d, d < 10 ? 2 : 0) + ' UA';
      const lm = d * 8.317;
      dist += ' · luz leva ' + (lm < 1 ? fmt(lm * 60, 0) + ' s' : lm < 120 ? fmt(lm, 1) + ' min' : fmt(lm / 60, 1) + ' h');
    } else if (lv === 2) {
      const ly = d * 1000;
      dist = ly < 1000 ? fmt(ly, ly < 10 ? 2 : 0) + ' anos-luz' : fmt(d, d < 10 ? 1 : 0) + ' mil anos-luz';
    } else dist = d < 1 ? fmt(d * 1000, 0) + ' mil anos-luz' : fmt(d, d < 10 ? 1 : 0) + ' milhões de anos-luz';

    let date = null;
    if (lv === 1) {
      try { date = jdToDate(this.state.jd).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { date = null; }
    }
    const near = this.ctl.dT > this.ctl.max * 0.9 && lv < 3;
    let hint = near ? HINTS[lv] : '';
    if (!hint && lv === 1 && this.state.scaleS > 1 && d > 1) hint = `Tamanhos ampliados ×${this.state.scaleS} para caber na tela; distâncias são reais`;
    return { dist, date, reversing: this.state.dir < 0, hint };
  }

  /* ===================== ENTRADA ===================== */
  bindInput() {
    const canvas = this.canvas, ptrs = new Map();
    let down = null, pinch0 = 0;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, moved: false, touch: e.pointerType === 'touch' };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); if (down) down.moved = true; }
      canvas.classList.add('drag');
    });
    canvas.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (p) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
        if (ptrs.size === 1) {
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
          if (down?.moved) { this.ctl.yaw -= dx * 0.0055; this.ctl.pitch += dy * 0.0055; }
          this.labels.setHover(null, 0, 0, canvas);
        } else if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch0 > 0) this.zoomBy(pinch0 / d);
          pinch0 = d;
        }
      } else if (e.pointerType === 'mouse') {
        this.labels.setHover(this.labels.pickAt(this.level, e.clientX, e.clientY, 12), e.clientX, e.clientY, canvas);
      }
    });
    const end = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId); canvas.classList.remove('drag');
      if (ptrs.size === 0 && down && !down.moved && e.type === 'pointerup') {
        const o = this.labels.pickAt(this.level, e.clientX, e.clientY, down.touch ? 26 : 14);
        if (o) this.select(o.id);
      }
      if (ptrs.size === 0) down = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { if (!ptrs.size) this.labels.setHover(null, 0, 0, canvas); });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      this.zoomBy(Math.exp(clamp(d, -300, 300) * 0.0016));
    }, { passive: false });
    addEventListener('keydown', e => {
      if (!this.active) return;
      if (e.key === 'Escape') this.select(null);
      if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); this.togglePlay(); }
    });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.skyCam.aspect = w / h;
    this.skyCam.updateProjectionMatrix();
    const scale = (h * this.renderer.getPixelRatio()) / (2 * FOVT);
    this.galaxy.material.uniforms.uScale.value = scale;
    this.universe.material.uniforms.uScale.value = scale;
  }

  /* Liga/desliga a cena quando a aba do simulador aparece ou some: oculto, o
     motor não desenha nem responde ao teclado (economiza GPU e bateria). */
  setActive(on) {
    this.active = !!on;
    if (this.active) this.resize();
  }

  /* ===================== LOOP ===================== */
  start() {
    let last = performance.now();
    const frame = now => {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (!this.active) return;
      this.step(dt);
    };
    requestAnimationFrame(frame);
  }

  step(dt) {
    const st = this.state, lv = st.level;
    if (st.playing) {
      if (lv === 1) st.jd += dt * st.sp[1] * st.dir;
      else st.galAngle -= ((Math.PI * 2) / 225) * st.sp[2] * dt * st.dir; // uma volta da galáxia ≈ 225 milhões de anos
    }
    this.galaxy.group.rotation.y = st.galAngle;
    this.universe.mwGroup.rotation.y = st.galAngle;
    if (lv === 1) this.solar.update(dt, st.jd);
    const level = this.level;
    level.scene.updateMatrixWorld(true);
    this.updateCamera(dt);
    if (lv === 3) this.universe.updateSprites(dt, this.camera, this.renderer.domElement.clientHeight, FOVT);
    this.labels.project(level, this.camera, this.ctl.dist, FOVT);
    this.labels.update(level, Object.values(this.levels), st.labels);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.on.hud?.(this.hud()); }
    const r = this.renderer;
    r.clear();
    if (level.sky) r.render(level.sky, this.skyCam);
    r.clearDepth();
    r.render(level.scene, this.camera);
  }
}

export async function createEngine(opts, data, progress) {
  const engine = new Engine(opts);
  await engine.build(data, progress);
  engine.start();
  window.__atlas = engine; // útil para depurar no console do navegador
  return engine;
}
