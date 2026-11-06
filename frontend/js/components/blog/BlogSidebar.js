/* Coluna lateral do blog: agenda de lançamentos, clima espacial, asteroides da
   semana e tecnologias da NASA. Cada bloco carrega sozinho e mostra o próprio
   erro, para que uma fonte fora do ar não derrube a página inteira. */
import { reactive, ref, computed, onMounted } from 'vue';
import { api, once } from '../../api.js';
import { fmt } from '../../engine/util.js';
import { now, countdown, dateTime, hideBroken } from './format.js';

/* Estado padrão de um bloco que busca dados: { data, error }. */
function useSource(key, fn) {
  const s = reactive({ data: null, error: null });
  onMounted(() => once(key, fn).then(d => { s.data = d; }, e => { s.error = e.message; }));
  return s;
}

const FLARE_COLORS = { A: 'var(--muted)', B: 'var(--muted)', C: 'var(--sky)', M: 'var(--warn)', X: 'var(--bad)' };

export default {
  name: 'BlogSidebar',
  setup() {
    const launches = useSource('launches', api.blogLaunches);
    const flares = useSource('flares', api.flares);
    const neos = useSource('neoWeek', api.neoWeek);

    /* Os lançamentos seguintes ao destaque do topo. */
    const upcoming = computed(() => {
      const list = launches.data?.launches || [];
      const i = list.findIndex(l => Date.parse(l.net) > now.value - 3600e3);
      return list.slice((i < 0 ? 0 : i) + 1);
    });
    const tminus = iso => {
      const t = countdown(iso, now.value);
      if (!t) return '';
      return t.d > 0 ? `T${t.sign} ${t.d}d ${t.h}h` : `T${t.sign} ${t.h}:${t.m}:${t.s}`;
    };

    const nearest = computed(() => (neos.data?.objects || []).slice(0, 4));
    const neoDate = n => (n.approach_epoch_ms
      ? new Date(n.approach_epoch_ms).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      : n.approach_date);

    /* Tecnologias da NASA: as áreas vêm de /api/blog/topics. */
    const areas = ref([]), area = ref(null);
    const tech = reactive({ data: null, error: null, loading: false });
    async function pickArea(key) {
      area.value = key; tech.loading = true; tech.error = null;
      try { tech.data = await once('tech:' + key, () => api.blogTech(key)); } catch (e) { tech.error = e.message; tech.data = null; } finally { if (area.value === key) tech.loading = false; }
    }
    onMounted(async () => {
      try {
        const t = await once('blogTopics', api.blogTopics);
        areas.value = t.tech_areas;
        if (t.tech_areas.length) pickArea(t.tech_areas[0].key);
      } catch (e) { tech.error = e.message; }
    });

    return { launches, upcoming, tminus, flares, FLARE_COLORS, neos, nearest, neoDate, areas, area, tech, pickArea, fmt, dateTime, hideBroken };
  },
  template: `
  <aside class="side" aria-label="Painéis ao vivo">
    <section class="panel box">
      <h3>Agenda de lançamentos</h3>
      <ul class="launches" v-if="upcoming.length">
        <li v-for="l in upcoming" :key="l.id">
          <a :href="l.page_url" target="_blank" rel="noopener">
            <div class="lname">{{ l.name }}</div>
            <div class="muted lsub">{{ dateTime(l.net) }}<span v-if="l.provider"> · {{ l.provider }}</span></div>
          </a>
          <span class="tminus">{{ tminus(l.net) }}</span>
        </li>
      </ul>
      <p v-else-if="launches.error" class="muted">{{ launches.error }}</p>
      <p v-else-if="launches.data" class="muted">Nenhum outro lançamento agendado.</p>
      <div v-else class="skel line3"></div>
      <p class="bsrc">Fonte: Launch Library 2 · The Space Devs<span v-if="launches.data?.stale"> · dados guardados</span></p>
    </section>

    <section class="panel box">
      <h3>Clima espacial · 30 dias</h3>
      <template v-if="flares.data">
        <p class="big-n"><b>{{ flares.data.count }}</b> erupções solares registradas</p>
        <div class="pills" v-if="Object.keys(flares.data.by_class).length">
          <span v-for="(n, c) in flares.data.by_class" :key="c" class="pill" :style="{ borderColor: FLARE_COLORS[c] }">Classe {{ c }}: <b>{{ n }}</b></span>
        </div>
        <p v-if="flares.data.strongest" class="small">Mais forte: <b>{{ flares.data.strongest.class_type }}</b> em {{ dateTime(flares.data.strongest.peak_time) }}<span v-if="flares.data.strongest.active_region"> · região ativa {{ flares.data.strongest.active_region }}</span></p>
        <p class="muted small">A, B, C, M e X: cada classe libera 10 vezes mais energia em raios X que a anterior.</p>
      </template>
      <p v-else-if="flares.error" class="muted">{{ flares.error }}</p>
      <div v-else class="skel line3"></div>
      <p class="bsrc">Fonte: NASA DONKI<span v-if="flares.data?.stale"> · dados guardados</span></p>
    </section>

    <section class="panel box">
      <h3>Asteroides que passam perto nesta semana</h3>
      <template v-if="neos.data">
        <p class="small muted">{{ neos.data.total_in_week }} asteroides passam pela Terra entre {{ neos.data.start }} e {{ neos.data.end }}. Os mais próximos:</p>
        <ul class="neos">
          <li v-for="n in nearest" :key="n.id">
            <a :href="n.jpl_url" target="_blank" rel="noopener" v-if="n.jpl_url">{{ n.name }}</a><span v-else>{{ n.name }}</span>
            <span class="muted">{{ neoDate(n) }} · {{ fmt(n.miss_distance_lunar, 1) }}× Terra–Lua</span>
          </li>
        </ul>
        <a class="linkbtn" href="#/simulador">Ver as órbitas no simulador →</a>
      </template>
      <p v-else-if="neos.error" class="muted">{{ neos.error }}</p>
      <div v-else class="skel line3"></div>
      <p class="bsrc">Fonte: NASA NeoWs<span v-if="neos.data?.stale"> · dados guardados</span></p>
    </section>

    <section class="panel box">
      <h3>Tecnologias da NASA</h3>
      <p class="small muted">Invenções do programa espacial disponíveis para empresas e pesquisadores.</p>
      <div class="chips small-chips" v-if="areas.length">
        <button v-for="a in areas" :key="a.key" class="fchip" :class="{ on: area === a.key }" :aria-pressed="area === a.key" :title="a.description" @click="pickArea(a.key)">{{ a.label }}</button>
      </div>
      <div v-if="tech.loading" class="skel line3"></div>
      <ul class="tech" v-else-if="tech.data && tech.data.items.length">
        <li v-for="t in tech.data.items" :key="t.id">
          <a :href="t.page_url" target="_blank" rel="noopener">
            <span class="timg" data-img v-if="t.image_url"><img :src="t.image_url" alt="" loading="lazy" @error="hideBroken"></span>
            <span>
              <b>{{ t.title }}</b>
              <small class="muted">{{ [t.category, t.center].filter(Boolean).join(' · ') }}</small>
            </span>
          </a>
        </li>
      </ul>
      <p v-else-if="tech.error" class="muted">{{ tech.error }}</p>
      <p v-else-if="tech.data" class="muted">Nenhuma tecnologia encontrada nesta área.</p>
      <p class="bsrc">Fonte: NASA Technology Transfer<span v-if="tech.data?.stale"> · dados guardados</span></p>
    </section>

    <a class="panel box cta" href="#/simulador">
      <span class="chip" style="--c: var(--sky)"><i></i>Simulador 3D</span>
      <b>Viaje do Sol até as galáxias</b>
      <span class="muted">Órbitas reais do JPL, sondas, asteroides desta semana e milhares de estrelas com planetas.</span>
      <span class="act">Abrir o simulador</span>
    </a>
  </aside>`,
};
