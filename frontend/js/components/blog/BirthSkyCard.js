import { ref } from 'vue';
import { dateLong, hideBroken } from './format.js';
import useBirthSky from './useBirthSky.js';

export default {
  name: 'BirthSkyCard',
  setup() {
    const sky = useBirthSky();
    const dateInput = ref(null);
    const focusDate = () => dateInput.value?.focus();
    const submit = () => sky.load(sky.date.value);

    return {
      ...sky, dateInput,
      focusDate, submit, dateLong, hideBroken,
    };
  },
  template: `
  <section id="birth-sky" class="birth-sky" aria-labelledby="birth-sky-title">
    <div class="birth-heading">
      <span class="eyebrow">Arquivo do universo</span>
      <h2 id="birth-sky-title">Foto tirada no dia do seu nascimento</h2>
      <p v-if="unsupportedDate">A APOD ainda não existia nessa data. Veja imagens reais da NASA do mesmo ano ou a primeira APOD publicada.</p>
      <p v-else>Esta é a Imagem Astronômica do Dia publicada pela NASA na data do seu nascimento.</p>
    </div>
    <form class="birth-form" novalidate @submit.prevent="submit">
      <label for="birth-date">Data de nascimento</label>
      <div class="birth-controls">
        <input ref="dateInput" id="birth-date" v-model="date" type="date" min="1900-01-01" :max="today" required>
        <button class="pill-primary" type="submit" :disabled="loading || !date">Ver meu céu</button>
      </div>
    </form>

    <div v-if="error" class="birth-error" role="alert">
      <span>{{ error }}</span>
      <button v-if="date && date <= today" class="text-button" type="button" :disabled="loading" @click="load(date, true)">Tentar de novo</button>
    </div>
    <div v-if="loading" class="birth-image-skeleton" aria-label="Carregando imagem astronômica"></div>
    <div v-if="historicalError" class="birth-error" role="alert">
      <span>{{ historicalError }}</span>
      <button class="text-button" type="button" :disabled="loading" @click="load(date, true)">Tentar de novo</button>
    </div>

    <section v-if="historicalImages.length" class="historical-images" aria-labelledby="historical-images-title">
      <span class="eyebrow">NASA Image and Video Library</span>
      <h3 id="historical-images-title">Imagem mais próxima do seu ano de nascimento</h3>
      <p>Essas imagens são de {{ date.slice(0, 4) }}, mas não são a APOD da sua data exata.</p>
      <div class="historical-image-grid">
        <a v-for="image in historicalImages" :key="image.nasa_id" class="historical-image" :href="image.page_url" target="_blank" rel="noopener">
          <img :src="image.thumbnail" :alt="'Imagem NASA: ' + image.title" loading="lazy" width="320" height="200" @error="hideBroken">
          <span class="historical-image-copy">
            <b>{{ image.title }}</b>
            <time v-if="image.date_created" :datetime="image.date_created">{{ dateLong(image.date_created) }}</time>
            <small v-if="image.center">Crédito: {{ image.center }}</small>
          </span>
        </a>
      </div>
    </section>

    <section v-if="result" class="birth-result" aria-live="polite">
      <div class="birth-result-heading">
        <span class="eyebrow">{{ resultLabel }}</span>
        <h3>{{ result.title }}</h3>
        <time :datetime="result.date">{{ dateLong(result.date) }}</time>
      </div>
      <a v-if="result.media_type === 'video' && result.thumbnail_url" class="birth-photo" data-img :href="result.url" target="_blank" rel="noopener" :aria-label="'Assistir ao vídeo: ' + result.title">
        <img :src="result.thumbnail_url" :alt="'Miniatura do vídeo astronômico: ' + result.title" loading="lazy" width="960" height="600" @error="hideBroken">
        <span class="video-play" aria-hidden="true">▶</span>
      </a>
      <a v-else-if="result.media_type === 'image' && result.url" class="birth-photo" data-img :href="result.hdurl || result.url" target="_blank" rel="noopener">
        <img :src="result.url" :alt="'Imagem astronômica: ' + result.title" loading="lazy" width="960" height="600" @error="hideBroken">
      </a>
      <div v-else class="birth-video-link">
        <p>Esta edição da APOD é um vídeo.</p>
        <a :href="result.url" target="_blank" rel="noopener">Assistir à publicação ↗</a>
      </div>
      <div class="birth-result-copy">
        <p v-if="result.copyright" class="birth-credit">Crédito: {{ result.copyright }}</p>
        <details v-if="result.explanation" class="birth-explanation">
          <summary>Ler explicação completa</summary>
          <p>{{ result.explanation }}</p>
        </details>
        <div class="birth-source-links">
          <a v-if="result.hdurl" class="text-link" :href="result.hdurl" target="_blank" rel="noopener">Abrir em alta resolução ↗</a>
          <a v-if="result.url" class="text-link" :href="result.url" target="_blank" rel="noopener" :download="result.media_type === 'image' ? '' : null">
            {{ result.media_type === 'video' ? 'Abrir vídeo ↗' : 'Baixar imagem ↗' }}
          </a>
          <a v-if="result.page_url" class="text-link" :href="result.page_url" target="_blank" rel="noopener">Ver na fonte ↗</a>
        </div>
      </div>
    </section>

    <div v-if="result || historicalImages.length" class="birth-footer">
      <button class="pill-secondary" type="button" @click="share">Compartilhar</button>
      <button class="text-button" type="button" @click="focusDate">Trocar data</button>
      <span class="share-message" role="status" aria-live="polite">{{ shareMessage }}</span>
    </div>
  </section>`,
};
