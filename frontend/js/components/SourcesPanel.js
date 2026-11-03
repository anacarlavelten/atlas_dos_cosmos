/* Painel "Dados da NASA": mostra, para cada fonte, se os dados vieram ao vivo,
   do cache ou da tabela aproximada (quando a NASA não respondeu). */
import { computed } from 'vue';
import { store } from '../store.js';

export function sourceRows() {
  const rows = [];
  const o = store.orbits;
  if (o) {
    const jpl = o.bodies.filter(b => b.source !== 'aproximado').length;
    const status = jpl === o.bodies.length ? 'ok' : jpl === 0 ? 'fallback' : 'partial';
    rows.push({ name: 'Órbitas — JPL Horizons e SBDB', status, detail: status === 'ok' ? `${jpl} astros com elementos orbitais do JPL` : `${jpl} de ${o.bodies.length} astros do JPL; o resto usa a tabela aproximada` });
    const craftJpl = o.spacecraft.filter(s => s.source !== 'aproximado').length;
    rows.push({ name: 'Sondas — JPL Horizons', status: craftJpl === o.spacecraft.length ? 'ok' : 'fallback', detail: `${craftJpl} de ${o.spacecraft.length} com posição real` });
  } else rows.push({ name: 'Órbitas — JPL Horizons e SBDB', status: 'error', detail: store.errors.orbits || 'indisponível' });

  const n = store.neos;
  rows.push(n
    ? { name: 'Asteroides próximos — NASA NeoWs', status: n.stale ? 'stale' : 'ok', detail: `${n.objects.length} mais próximos de ${n.total_in_week} na semana${n.stale ? ' (dados guardados)' : ''}` }
    : { name: 'Asteroides próximos — NASA NeoWs', status: 'error', detail: store.errors.neos || 'indisponível' });

  const e = store.exo;
  rows.push(e
    ? { name: 'Exoplanetas — NASA Exoplanet Archive', status: e.stale ? 'stale' : 'ok', detail: `${e.total_planets.toLocaleString('pt-BR')} planetas em ${e.total_hosts.toLocaleString('pt-BR')} estrelas` }
    : { name: 'Exoplanetas — NASA Exoplanet Archive', status: 'error', detail: store.errors.exo || 'indisponível' });

  rows.push({ name: 'Fotos — APOD, EPIC e NASA Image Library', status: 'neutral', detail: 'buscadas quando você abre um card ou a foto do dia' });
  return rows;
}

export function overallStatus() {
  const rows = sourceRows();
  if (rows.some(r => r.status === 'error' || r.status === 'fallback')) return 'fallback';
  if (rows.some(r => r.status !== 'ok' && r.status !== 'neutral')) return 'partial';
  return 'ok';
}

export default {
  name: 'SourcesPanel',
  setup() {
    const rows = computed(sourceRows);
    const demo = computed(() => store.health?.using_demo_key);
    const quota = computed(() => store.health?.nasa_rate_limit?.remaining);
    return { store, rows, demo, quota };
  },
  template: `
  <div class="panel sources" v-if="store.sourcesOpen" role="dialog" aria-label="Fontes de dados">
    <h3>De onde vêm os dados</h3>
    <ul>
      <li v-for="r in rows" :key="r.name"><span class="dot" :class="r.status"></span>
        <div>{{ r.name }}<small>{{ r.detail }}</small></div></li>
    </ul>
    <p class="muted" style="font-size:12.5px;margin:12px 0 0">Os textos didáticos ficam no catálogo do próprio Atlas; os números que mudam com o tempo vêm da NASA e ficam guardados em cache no servidor.</p>
    <div class="keynote" v-if="demo">
      O servidor está usando a <b>DEMO_KEY</b> (limite baixo). Coloque a sua chave em <code>NASA_API_KEY</code> no arquivo <code>.env</code> e reinicie o servidor.
    </div>
    <p class="muted" style="font-size:12px;margin:8px 0 0" v-else-if="quota">Requisições restantes na sua chave nesta hora: {{ quota }}</p>
  </div>`,
};
