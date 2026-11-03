/* Painéis com dados ao vivo exibidos dentro do card. Cada um busca na API
   somente quando aparece na tela. */
import { ref, onMounted, computed } from 'vue';
import { api, once } from '../api.js';
import { store, engineRef } from '../store.js';
import { fmt } from '../engine/util.js';

const when = iso => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'; } catch { return iso; }
};

function useFetch(key, fn) {
  const data = ref(null), error = ref(null), loading = ref(true);
  onMounted(async () => {
    try { data.value = await once(key, fn); } catch (e) { error.value = e.message; } finally { loading.value = false; }
  });
  return { data, error, loading };
}

/* Fotos do astro na NASA Image and Video Library. */
export const ImageStrip = {
  name: 'ImageStrip',
  props: { slug: { type: String, required: true } },
  setup(props) { return useFetch(`img:${props.slug}`, () => api.images(props.slug)); },
  template: `
  <div class="live">
    <h4>Imagens da NASA</h4>
    <div class="gallery" v-if="loading"><div class="skel" v-for="i in 4" :key="i"></div></div>
    <p class="muted" v-else-if="error" style="margin:0">Imagens indisponíveis agora.</p>
    <p class="muted" v-else-if="!data.images.length" style="margin:0">Nenhuma imagem encontrada.</p>
    <div class="gallery" v-else>
      <a v-for="im in data.images" :key="im.nasa_id" :href="im.page_url" target="_blank" rel="noopener" :title="im.title">
        <img :src="im.thumbnail" :alt="im.title" loading="lazy"></a>
    </div>
    <p class="src" style="margin-top:6px">NASA Image and Video Library</p>
  </div>`,
};

/* Erupções solares dos últimos 30 dias (DONKI). */
export const FlaresWidget = {
  name: 'FlaresWidget',
  setup() { return { ...useFetch('flares', api.flares), when }; },
  template: `
  <div class="live">
    <h4>Atividade solar · últimos 30 dias</h4>
    <p class="muted" v-if="loading" style="margin:0">Consultando o DONKI…</p>
    <p class="muted" v-else-if="error" style="margin:0">{{ error }}</p>
    <template v-else>
      <div><b>{{ data.count }}</b> erupções solares registradas<span v-if="data.strongest">; a mais forte foi <b>{{ data.strongest.class_type }}</b> em {{ when(data.strongest.peak_time) }}</span>.</div>
      <div class="pills"><span class="pill" v-for="(n, k) in data.by_class" :key="k">classe {{ k }}: {{ n }}</span></div>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">Classes A, B, C, M e X: cada letra é 10 vezes mais forte que a anterior. Erupções X podem afetar rádio e GPS na Terra.</p>
      <p class="src" style="margin-top:6px">NASA DONKI (clima espacial)<span v-if="data.stale"> · dados guardados</span></p>
    </template>
  </div>`,
};

/* A Terra inteira fotografada pela câmera EPIC, a 1,5 milhão de km. */
export const EpicWidget = {
  name: 'EpicWidget',
  setup() { return { ...useFetch('epic', api.epic), when }; },
  template: `
  <div class="live epic">
    <h4>A Terra agora · câmera EPIC</h4>
    <div class="skel" v-if="loading" style="aspect-ratio:1"></div>
    <p class="muted" v-else-if="error || !data.images.length" style="margin:0">Foto indisponível agora.</p>
    <template v-else>
      <a :href="data.images[0].image_url" target="_blank" rel="noopener"><img :src="data.images[0].thumbnail_url" alt="Foto da Terra inteira tirada pela câmera EPIC"></a>
      <div class="muted" style="font-size:12.5px">Foto real de {{ when(data.images[0].date.replace(' ', 'T') + 'Z') }}, tirada pelo satélite DSCOVR a 1,5 milhão de km da Terra.</div>
    </template>
  </div>`,
};

/* Lista dos asteroides da semana (usa os dados já carregados no início). */
export const NeosWidget = {
  name: 'NeosWidget',
  setup() {
    const list = computed(() => store.neos?.objects || []);
    const go = id => engineRef.current?.select(`neo:${id}`);
    return { store, list, go, fmt };
  },
  template: `
  <div class="live">
    <h4>Mais próximos nesta semana</h4>
    <p class="muted" v-if="!store.neos" style="margin:0">{{ store.errors.neos || 'Dados indisponíveis.' }}</p>
    <template v-else>
      <div class="muted" style="font-size:12.5px">{{ store.neos.total_in_week }} asteroides passam perto da Terra entre {{ store.neos.start }} e {{ store.neos.end }}.</div>
      <ul>
        <li v-for="n in list" :key="n.id"><button @click="go(n.id)" :disabled="!n.elements">{{ n.name }}</button>
          <span class="muted">{{ fmt(n.miss_distance_lunar, 1) }} × Terra–Lua</span></li>
      </ul>
    </template>
  </div>`,
};

/* Resumo do NASA Exoplanet Archive. */
export const ExoWidget = {
  name: 'ExoWidget',
  setup() {
    const methods = computed(() => Object.entries(store.exo?.by_method || {}).slice(0, 4));
    return { store, methods, fmt };
  },
  template: `
  <div class="live">
    <h4>Exoplanetas confirmados</h4>
    <p class="muted" v-if="!store.exo" style="margin:0">{{ store.errors.exo || 'Dados indisponíveis.' }}</p>
    <template v-else>
      <div><b>{{ fmt(store.exo.total_planets, 0) }}</b> planetas em <b>{{ fmt(store.exo.total_hosts, 0) }}</b> estrelas.</div>
      <div class="muted" style="font-size:12.5px;margin-top:8px">Sistemas mais próximos do Sol:</div>
      <ul>
        <li v-for="h in store.exo.nearest.slice(0, 6)" :key="h.name"><span>{{ h.name }} <span class="muted">({{ h.planets }} {{ h.planets > 1 ? 'planetas' : 'planeta' }})</span></span>
          <span class="muted">{{ fmt(h.distance_ly, 1) }} anos-luz</span></li>
      </ul>
      <div class="pills"><span class="pill" v-for="[m, n] in methods" :key="m">{{ m }}: {{ fmt(n, 0) }}</span></div>
    </template>
  </div>`,
};
