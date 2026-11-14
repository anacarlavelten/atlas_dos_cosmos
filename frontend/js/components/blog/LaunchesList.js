import { computed, onMounted, ref, watch } from 'vue';
import { api, once } from '../../api.js';
import { dateTime, now } from './format.js';
import LaunchCountdown from './LaunchCountdown.js';
import { futureLaunches } from './launches.js';

const PER_PAGE = 2;

export default {
  name: 'LaunchesList',
  components: { LaunchCountdown },
  props: {
    hasNewsOnDate: { type: Function, default: () => false },
    openNewsDate: { type: Function, default: () => {} },
  },
  setup(props) {
    const data = ref(null);
    const error = ref('');
    const page = ref(0);
    const loading = ref(true);
    const launches = computed(() => futureLaunches(data.value?.launches, now.value));
    const pages = computed(() => Math.max(1, Math.ceil(launches.value.length / PER_PAGE)));
    const visible = computed(() => launches.value.slice(page.value * PER_PAGE, (page.value + 1) * PER_PAGE));
    watch(pages, value => { if (page.value >= value) page.value = value - 1; });

    async function load() {
      loading.value = true;
      error.value = '';
      try {
        data.value = await once('launches', api.blogLaunches);
      } catch (err) {
        error.value = err.message;
      } finally {
        loading.value = false;
      }
    }

    onMounted(load);
    return {
      data, error, loading, launches, pages, page, visible, load, dateTime,
      hasNewsOnDate: props.hasNewsOnDate,
      openNewsDate: props.openNewsDate,
    };
  },
  template: `
  <section class="portal-card launches-module" aria-labelledby="launches-title">
    <div class="module-heading"><span class="eyebrow">Agenda de voos</span><h2 id="launches-title">Lançamentos e pousos</h2></div>
    <div v-if="loading" class="launch-list-skeleton" aria-label="Carregando lançamentos"><i></i><i></i></div>
    <div v-else-if="error" class="module-error" role="alert">{{ error }} <button class="text-button" type="button" @click="load">Tentar novamente</button></div>
    <template v-else-if="launches.length">
      <ul class="launch-list">
        <li v-for="(launch, index) in visible" :key="launch.id">
          <a :href="launch.page_url" target="_blank" rel="noopener" class="launch-name">{{ launch.name }}</a>
          <a v-if="hasNewsOnDate(launch.net)" class="launch-date-link" href="#latest-stories" @click.prevent="openNewsDate(launch.net)" :aria-label="'Ver notícias de ' + dateTime(launch.net)">
            <time :datetime="launch.net">{{ dateTime(launch.net) }}</time>
          </a>
          <time v-else-if="launch.net" :datetime="launch.net">{{ dateTime(launch.net) }}</time>
          <span v-else>Data a confirmar</span>
          <span class="launch-operator">{{ launch.provider || 'Operador não informado' }}</span>
          <LaunchCountdown :launch="launch" :variant="index === 0 ? 'compact' : 'summary'" />
        </li>
      </ul>
      <nav class="dot-pagination" aria-label="Páginas de lançamentos">
        <button v-for="index in pages" :key="index" type="button" :aria-label="'Página ' + index" :aria-current="page === index - 1 ? 'page' : null" :class="{ active: page === index - 1 }" @click="page = index - 1">{{ index }}</button>
      </nav>
    </template>
    <p v-else class="module-muted">Nenhum lançamento agendado.</p>
    <p class="module-source">Fonte: Launch Library 2 · The Space Devs<span v-if="data?.stale"> · dados em cache</span></p>
  </section>`,
};
