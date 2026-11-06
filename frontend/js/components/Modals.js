/* Janelas: introdução e foto astronômica do dia (APOD). */
import { ref, watch } from 'vue';
import { store } from '../store.js';
import { api, once } from '../api.js';

export const IntroModal = {
  name: 'IntroModal',
  setup() { return { store }; },
  template: `
  <div class="overlay" v-if="store.introOpen && store.view === 'sim'" @click.self="store.introOpen = false">
    <div class="panel modal" role="dialog" aria-modal="true" aria-labelledby="intro-t">
      <h1 id="intro-t">Atlas do <b>Cosmos</b></h1>
      <p>Viaje do Sol até as galáxias mais distantes. As órbitas, as sondas, os asteroides desta semana e as estrelas com planetas vêm das APIs da NASA; as distâncias são proporcionais às reais.</p>
      <ul class="keys">
        <li><b>Arrastar</b>girar a câmera</li>
        <li><b>Rolar / pinça</b>aproximar e afastar. Afaste bastante para mudar de escala.</li>
        <li><b>Passar o mouse</b>ver o nome do astro</li>
        <li><b>Clicar</b>voar até o astro e abrir o card com dados e fotos da NASA</li>
        <li><b>Espaço</b>pausar ou continuar o tempo</li>
      </ul>
      <button class="act" @click="store.introOpen = false" :disabled="store.phase !== 'ready'">
        {{ store.phase === 'ready' ? 'Começar a viagem' : 'Carregando…' }}</button>
    </div>
  </div>`,
};

export const ApodModal = {
  name: 'ApodModal',
  setup() {
    const data = ref(null), error = ref(null), loading = ref(false);
    watch(() => store.apodOpen, async open => {
      if (!open || data.value) return;
      loading.value = true; error.value = null;
      try { data.value = await once('apod', api.apod); } catch (e) { error.value = e.message; } finally { loading.value = false; }
    });
    const embed = url => (url && /youtube\.com\/embed|player\.vimeo/.test(url) ? url : null);
    const day = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return iso; } };
    return { store, data, error, loading, embed, day };
  },
  template: `
  <div class="overlay" v-if="store.apodOpen" @click.self="store.apodOpen = false">
    <div class="panel modal wide" role="dialog" aria-modal="true" aria-label="Foto astronômica do dia">
      <button class="x" aria-label="Fechar" @click="store.apodOpen = false">×</button>
      <span class="chip" style="--c: var(--sun)"><i></i>Foto astronômica do dia · NASA APOD</span>
      <p v-if="loading" class="muted" style="margin-top:14px">Buscando a foto de hoje…</p>
      <p v-else-if="error" style="margin-top:14px">{{ error }}</p>
      <template v-else-if="data">
        <h2>{{ data.title }}</h2>
        <iframe v-if="data.media_type === 'video' && embed(data.url)" class="apod-media" :src="embed(data.url)" allowfullscreen title="Vídeo do dia"></iframe>
        <a v-else-if="data.media_type === 'video'" :href="data.url" target="_blank" rel="noopener">
          <img v-if="data.thumbnail_url" class="apod-media" :src="data.thumbnail_url" :alt="data.title"><span v-else>Assistir ao vídeo ↗</span></a>
        <a v-else :href="data.hdurl || data.url" target="_blank" rel="noopener"><img class="apod-media" :src="data.url" :alt="data.title"></a>
        <p class="muted" style="font-size:13px">{{ day(data.date) }}<span v-if="data.copyright"> · © {{ data.copyright }}</span> · texto original da NASA, em inglês</p>
        <p lang="en">{{ data.explanation }}</p>
        <a :href="data.page_url" target="_blank" rel="noopener">Ver no site do APOD ↗</a>
      </template>
    </div>
  </div>`,
};
