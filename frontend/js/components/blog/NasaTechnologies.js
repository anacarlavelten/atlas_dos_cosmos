import { onMounted, ref } from 'vue';
import { api, once } from '../../api.js';
import { hideBroken } from './format.js';
import { loadSource, sourceState } from './useSource.js';

export default {
  name: 'NasaTechnologies',
  setup() {
    const areas = ref([]);
    const area = ref(null);
    const tech = sourceState();

    async function pickArea(key) {
      area.value = key;
      await loadSource(tech, 'tech:' + key, () => api.blogTech(key));
    }

    async function loadTopics() {
      tech.loading = true;
      tech.error = '';
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

    onMounted(loadTopics);
    return { areas, area, tech, pickArea, loadTopics, hideBroken };
  },
  template: `
  <section id="technology-tools" class="technology-widget page-card" aria-labelledby="technology-title">
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
  </section>`,
};
