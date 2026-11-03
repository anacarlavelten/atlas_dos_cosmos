/* Estado reativo compartilhado pelos componentes Vue.
   Dados grandes (órbitas, exoplanetas...) entram com markRaw: o Vue não precisa
   observá-los e o motor 3D os recebe como objetos simples. */
import { reactive, markRaw } from 'vue';
import { CATCOL, fmt } from './engine/util.js';

export const store = reactive({
  phase: 'loading',            // loading | ready | error
  loadingMsg: 'Preparando o céu…',
  fatal: null,
  health: null,
  levels: [],
  level: 1,
  bodies: [],
  orbits: null,
  neos: null,
  exo: null,
  errors: {},                  // erro por fonte: { orbits, neos, exo }
  selectedId: null,
  listOpen: false,
  introOpen: true,
  apodOpen: false,
  sourcesOpen: false,
  playing: true,
  dir: 1,
  speedValue: 400,
  speedLabel: '',
  scaleValue: 68,
  scaleLabel: '',
  showOrbits: true,
  showNames: true,
  showNeos: true,
  showExo: true,
  hud: { dist: '', date: null, reversing: false, hint: '' },
});

/* Referência ao motor 3D (preenchida quando a cena termina de carregar). */
export const engineRef = { current: null };

export const raw = v => (v && typeof v === 'object' ? markRaw(v) : v);

export function bodyBySlug(slug) {
  return store.bodies.find(b => b.slug === slug) || null;
}

export function neoById(id) {
  return store.neos?.objects?.find(n => n.id === id) || null;
}

export function orbitOf(slug) {
  return store.orbits?.bodies?.find(o => o.slug === slug) || store.orbits?.spacecraft?.find(o => o.slug === slug) || null;
}

export const colorOf = cat => CATCOL[cat] || '#fff';

const fmtDay = iso => {
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
};
const fmtJd = jd => fmtDay(new Date((jd - 2440587.5) * 86400000).toISOString());

/* Monta o "modelo" do card a partir do id selecionado (astro do catálogo ou asteroide). */
export function cardFor(id) {
  if (!id) return null;
  if (id.startsWith('neo:')) {
    const n = neoById(id.slice(4));
    if (!n) return null;
    const when = n.approach_epoch_ms ? new Date(n.approach_epoch_ms).toLocaleString('pt-BR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' (UTC)' : n.approach_date;
    const dmin = n.diameter_min_m, dmax = n.diameter_max_m;
    const facts = [
      { label: 'Maior aproximação', value: when },
      { label: 'Distância mínima', value: `${fmt(n.miss_distance_lunar, 1)} × Terra–Lua (${fmt(n.miss_distance_km / 1e6, 2)} milhões km)` },
      { label: 'Velocidade relativa', value: `${fmt(n.velocity_km_s, 1)} km/s` },
    ];
    if (dmin && dmax) facts.push({ label: 'Diâmetro estimado', value: `${fmt(dmin, 0)} a ${fmt(dmax, 0)} m` });
    if (n.orbit_class) facts.push({ label: 'Classe da órbita', value: n.orbit_class });
    facts.push({ label: 'Potencialmente perigoso', value: n.hazardous ? 'Sim (monitorado)' : 'Não' });
    return {
      id, slug: null, name: n.name, category: 'neo',
      kind: n.hazardous ? 'Asteroide potencialmente perigoso' : 'Asteroide próximo da Terra',
      summary: `Este asteroide passa pela Terra nesta semana a cerca de ${fmt(n.miss_distance_lunar, 1)} vezes a distância até a Lua. A órbita desenhada é a calculada pelo JPL.`,
      facts, curiosity: null, action: null, live: [],
      source: `Fonte: NASA NeoWs${n.elements ? ' · órbita: JPL (época ' + fmtJd(n.elements.epoch_jd) + ')' : ''}`,
      link: n.jpl_url ? { url: n.jpl_url, label: 'Ver no banco de dados do JPL' } : null,
    };
  }
  const b = bodyBySlug(id);
  if (!b) return null;
  const orbit = orbitOf(b.slug);
  let source = null;
  if (orbit) {
    const isCraft = 'position' in orbit;
    source = orbit.source === 'aproximado'
      ? `${isCraft ? 'Posição' : 'Órbita'} aproximada (sem conexão com o JPL no momento)`
      : `${isCraft ? 'Posição' : 'Órbita'}: ${orbit.source} · dados de ${fmtJd(orbit.epoch_jd ?? orbit.elements.epoch_jd)}`;
  }
  return { id, slug: b.slug, name: b.name, kind: b.kind, category: b.category, summary: b.summary, facts: b.facts, curiosity: b.curiosity, action: b.action, live: b.live || [], source, link: null };
}
