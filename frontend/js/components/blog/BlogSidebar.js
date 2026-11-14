import { reactive, ref, computed, onMounted } from 'vue';
import { api, once } from '../../api.js';
import { fmt } from '../../engine/util.js';
import { dateTime, hideBroken } from './format.js';

function sourceState() {
  return reactive({ data: null, error: '', loading: true });
}

async function loadSource(state, key, fetcher) {
  state.loading = true;
  state.error = '';
  try {
    state.data = await once(key, fetcher);
  } catch (error) {
    state.error = error.message || 'Não foi possível carregar esta fonte.';
  } finally {
    state.loading = false;
  }
}

export default {
  name: 'BlogSidebar',
  setup() {
    const flares = sourceState();
    const neos = sourceState();
    const areas = ref([]);
    const area = ref(null);
    const tech = sourceState();
    const nearest = computed(() => (neos.data?.objects || []).slice(0, 4));
    const retryFlares = () => loadSource(flares, 'flares', api.flares);
    const retryNeos = () => loadSource(neos, 'neoWeek', api.neoWeek);
    const neoDate = object => (object.approach_epoch_ms
      ? new Date(object.approach_epoch_ms).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      : object.approach_date);

    async function pickArea(key) {
      area.value = key;
      await loadSource(tech, 'tech:' + key, () => api.blogTech(key));
    }

    async function loadTopics() {
      try {
        const topics = await once('blogTopics', api.blogTopics);
        areas.value = topics.tech_areas;
        if (topics.tech_areas.length) await pickArea(topics.tech_areas[0].key);
        else tech.loading = false;
      } catch (error) {
        tech.error = error.message || 'Não foi possível carregar as tecnologias.';
        tech.loading = false;
      }
    }

    onMounted(() => {
      loadSource(flares, 'flares', api.flares);
      loadSource(neos, 'neoWeek', api.neoWeek);
      loadTopics();
    });

    return { flares, neos, nearest, neoDate, areas, area, tech, pickArea, fmt, dateTime, hideBroken, retryFlares, retryNeos, loadTopics };
  },
  template: `
  <div class="support-modules">
    <section id="space-weather" class="signal-card" aria-labelledby="space-weather-title">
      <div class="module-heading"><span class="eyebrow">NASA DONKI · 30 DIAS</span><h2 id="space-weather-title">Clima espacial</h2></div>
      <div v-if="flares.loading" class="signal-skeleton" aria-label="Carregando clima espacial"></div>
      <div v-else-if="flares.error" class="module-error" role="alert">{{ flares.error }} <button class="text-button" type="button" @click="retryFlares">Tentar de novo</button></div>
      <template v-else-if="flares.data">
        <p class="signal-stat"><b>{{ flares.data.count }}</b> erupções solares registradas</p>
        <div class="signal-pills"><span v-for="(count, kind) in flares.data.by_class" :key="kind">Classe {{ kind }} <b>{{ count }}</b></span></div>
        <p v-if="flares.data.strongest" class="signal-detail">Mais forte: <b>classe {{ flares.data.strongest.class_type }}</b> · {{ dateTime(flares.data.strongest.peak_time) }}</p>
        <p class="signal-source">Fonte: NASA DONKI<span v-if="flares.data.stale"> · dados em cache</span></p>
      </template>
    </section>

    <section id="near-asteroids" class="signal-card" aria-labelledby="near-asteroids-title">
      <div class="module-heading"><span class="eyebrow">NASA NEOWS · ESTA SEMANA</span><h2 id="near-asteroids-title">Asteroides próximos</h2></div>
      <div v-if="neos.loading" class="signal-skeleton" aria-label="Carregando asteroides próximos"></div>
      <div v-else-if="neos.error" class="module-error" role="alert">{{ neos.error }} <button class="text-button" type="button" @click="retryNeos">Tentar de novo</button></div>
      <template v-else-if="neos.data">
        <p class="signal-stat"><b>{{ neos.data.total_in_week }}</b> objetos próximos nesta semana</p>
        <ul class="near-list"><li v-for="object in nearest" :key="object.id"><a v-if="object.jpl_url" :href="object.jpl_url" target="_blank" rel="noopener">{{ object.name }}</a><span v-else>{{ object.name }}</span><small>{{ neoDate(object) }} · {{ fmt(object.miss_distance_lunar, 1) }}× Terra–Lua</small></li></ul>
        <a class="signal-link" href="#/simulador">Explorar órbitas no simulador ↗</a>
        <p class="signal-source">Fonte: NASA NeoWs<span v-if="neos.data.stale"> · dados em cache</span></p>
      </template>
    </section>

    <section id="technology-tools" class="technology-widget" aria-labelledby="technology-title">
      <div class="module-heading"><span class="eyebrow">NASA TECHNOLOGY TRANSFER</span><h2 id="technology-title">Tecnologias espaciais</h2></div>
      <p class="module-muted">Invenções do programa espacial disponíveis para empresas e pesquisadores.</p>
      <div class="chips tool-topics" v-if="areas.length">
        <button v-for="item in areas" :key="item.key" class="topic-pill" :class="{ active: area === item.key }" :aria-pressed="area === item.key" :title="item.description" @click="pickArea(item.key)">#{{ item.label }}</button>
      </div>
      <div v-if="tech.loading" class="signal-skeleton" aria-label="Carregando tecnologias NASA"></div>
      <div v-else-if="tech.error" class="module-error" role="alert">{{ tech.error }} <button class="text-button" type="button" @click="area ? pickArea(area) : loadTopics()">Tentar de novo</button></div>
      <ul v-else-if="tech.data?.items.length" class="technology-list">
        <li v-for="item in tech.data.items" :key="item.id">
          <a :href="item.page_url" target="_blank" rel="noopener">
            <span class="technology-thumb" data-img v-if="item.image_url"><img :src="item.image_url" :alt="'Imagem da tecnologia: ' + item.title" loading="lazy" @error="hideBroken"></span>
            <span class="technology-copy"><b>{{ item.title }}</b><small>{{ [item.category, item.center].filter(Boolean).join(' · ') }}</small></span>
          </a>
        </li>
      </ul>
      <p v-else-if="tech.data" class="module-muted">Nenhuma tecnologia encontrada nesta área.</p>
      <p v-if="tech.data" class="signal-source">Fonte: NASA Technology Transfer<span v-if="tech.data.stale"> · dados em cache</span></p>
    </section>
  </div>`,
};
