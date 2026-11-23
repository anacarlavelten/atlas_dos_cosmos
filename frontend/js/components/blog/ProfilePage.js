import { computed, reactive, ref } from 'vue';
import { getAuthenticatedUser } from '../../auth.js';
import { loadProfile, saveProfile } from '../../profile.js';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1440;
const ASTRO_OPTIONS = [
  { value: 'lua', label: 'Lua' },
  { value: 'planetas', label: 'Planetas' },
  { value: 'estrelas', label: 'Estrelas / Constelações' },
  { value: 'galaxias', label: 'Galáxias' },
  { value: 'nebulosas', label: 'Nebulosas' },
  { value: 'outros', label: 'Outros' },
];
const INSTRUMENT_OPTIONS = [
  { value: 'olho_nu', label: 'Olho nu' },
  { value: 'binoculo', label: 'Binóculo' },
  { value: 'telescopio', label: 'Telescópio' },
  { value: 'camera', label: 'Câmera / Smartphone' },
];
const SKY_QUALITY_OPTIONS = [
  { value: 'limpo', label: 'Limpo / sem nuvens' },
  { value: 'parcialmente_nublado', label: 'Parcialmente nublado' },
  { value: 'nublado', label: 'Nublado' },
  { value: 'poluicao_luminosa', label: 'Com poluição luminosa' },
  { value: 'neblina', label: 'Neblina / baixa visibilidade' },
];

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default {
  name: 'ProfilePage',
  setup() {
    const user = getAuthenticatedUser();
    if (!user) throw new Error('É necessário estar autenticado para abrir o perfil.');

    const loaded = loadProfile(user.email, user.name);
    const today = localDateValue();
    const hasLegacyPosts = loaded.profile.posts.some(post => !post?.astro);
    const posts = loaded.profile.posts.map((savedPost, index) => {
      const post = savedPost && typeof savedPost === 'object' ? savedPost : {};
      return {
        ...post,
        id: post.id || `legacy-${index}`,
        astro: post.astro || 'outros',
        observedAt: post.observedAt
          || (typeof post.createdAt === 'string' ? post.createdAt.slice(0, 10) : today),
        instrument: post.instrument || 'olho_nu',
        skyQuality: post.skyQuality || 'limpo',
        observerName: post.observerName || loaded.profile.name,
        location: post.location || loaded.profile.location,
        notes: post.notes || [post.title, post.story].filter(Boolean).join('\n\n'),
        image: post.image || '',
        liked: Boolean(post.liked),
        saved: Boolean(post.saved),
      };
    });
    const state = reactive({
      profile: { ...loaded.profile, posts },
      error: loaded.error,
      notice: '',
    });
    const form = reactive({
      astro: '',
      observedAt: today,
      instrument: '',
      skyQuality: '',
      observerName: user.name,
      location: loaded.profile.location,
      notes: '',
      image: '',
    });
    const photoInput = ref(null);
    const filterAstro = ref('');
    const filteredPosts = computed(() => filterAstro.value
      ? state.profile.posts.filter(post => post.astro === filterAstro.value)
      : state.profile.posts);
    const initials = computed(() => state.profile.name.trim().split(/\s+/).slice(0, 2)
      .map(part => part.charAt(0)).join('').toUpperCase());

    if (!loaded.error && (!loaded.exists || hasLegacyPosts)) {
      const result = saveProfile(user.email, state.profile);
      if (!result.ok) state.error = result.error;
    }

    function readPhoto(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      state.error = '';
      state.notice = '';
      form.image = '';
      if (!file.type.startsWith('image/')) {
        state.error = 'Escolha um arquivo de imagem.';
        event.target.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        state.error = 'A imagem deve ter até 12 MB.';
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => { state.error = 'Não foi possível ler esta imagem.'; };
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => { state.error = 'Não foi possível abrir esta imagem.'; };
        image.onload = () => {
          const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            state.error = 'Não foi possível preparar a pré-visualização da imagem.';
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          form.image = canvas.toDataURL('image/jpeg', 0.84);
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    }

    function clearPhoto() {
      form.image = '';
      if (photoInput.value) photoInput.value.value = '';
    }

    function persistPosts(posts, notice) {
      const result = saveProfile(user.email, { ...state.profile, posts });
      if (!result.ok) {
        state.error = result.error;
        state.notice = '';
        return false;
      }
      state.profile.posts = posts;
      state.error = '';
      state.notice = notice;
      return true;
    }

    function publish() {
      state.error = '';
      state.notice = '';
      if (!form.astro || !form.observedAt || !form.instrument || !form.skyQuality
        || !form.observerName.trim() || !form.location.trim()) {
        state.error = 'Preencha todos os campos obrigatórios marcados com *.';
        return;
      }
      const post = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        astro: form.astro,
        observedAt: form.observedAt,
        instrument: form.instrument,
        skyQuality: form.skyQuality,
        observerName: form.observerName.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        image: form.image,
        liked: false,
        saved: false,
      };
      if (!persistPosts([post, ...state.profile.posts], 'Relato publicado no seu diário.')) return;
      form.astro = '';
      form.observedAt = today;
      form.instrument = '';
      form.skyQuality = '';
      form.observerName = state.profile.name;
      form.location = state.profile.location;
      form.notes = '';
      clearPhoto();
    }

    function togglePost(postId, key) {
      const posts = state.profile.posts.map(post => post.id === postId
        ? { ...post, [key]: !post[key] }
        : post);
      persistPosts(posts, 'Alteração salva no seu diário.');
    }

    function formatDate(value) {
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.valueOf())) return '';
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
    }

    const optionLabel = (options, value) => options.find(option => option.value === value)?.label || value;
    return {
      state, form, photoInput, filterAstro, filteredPosts, initials,
      astroOptions: ASTRO_OPTIONS, instrumentOptions: INSTRUMENT_OPTIONS, skyQualityOptions: SKY_QUALITY_OPTIONS,
      astroLabel: value => optionLabel(ASTRO_OPTIONS, value),
      instrumentLabel: value => optionLabel(INSTRUMENT_OPTIONS, value),
      skyQualityLabel: value => optionLabel(SKY_QUALITY_OPTIONS, value),
      readPhoto, clearPhoto, publish, togglePost, formatDate,
    };
  },
  template: `
  <section class="profile-page" aria-labelledby="profile-title">
    <header class="profile-header">
      <div class="profile-cover" role="img" aria-label="Céu noturno estrelado"></div>
      <div class="profile-avatar" aria-hidden="true">{{ initials }}</div>
      <div class="profile-details">
        <div class="profile-identity">
          <h1 id="profile-title">{{ state.profile.name }}</h1>
          <p>{{ state.profile.bio }}</p>
          <span class="profile-location">⌖ {{ state.profile.location }}</span>
        </div>
        <div class="profile-stats" aria-label="Estatísticas do perfil">
          <div><b>{{ state.profile.posts.length }}</b><span>Posts</span></div>
          <div><b>{{ state.profile.posts.length }}</b><span>Observações</span></div>
        </div>
      </div>
    </header>

    <section class="profile-composer" aria-labelledby="profile-composer-title">
      <div class="profile-section-heading">
        <div>
          <span class="profile-eyebrow">CIÊNCIA CIDADÃ</span>
          <h2 id="profile-composer-title">Diário de observação</h2>
          <p class="profile-section-description">Registre o que observou no céu e anexe uma foto. Seus relatos ficam salvos somente neste perfil.</p>
        </div>
      </div>
      <form class="profile-form" @submit.prevent="publish">
        <div class="profile-form-grid">
          <label class="profile-field" for="profile-astro">
            <span>Astro observado *</span>
            <select id="profile-astro" v-model="form.astro" class="profile-input profile-select" required>
              <option value="" disabled>Escolha um astro...</option>
              <option v-for="option in astroOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="profile-field" for="profile-date">
            <span>Data *</span>
            <input id="profile-date" v-model="form.observedAt" class="profile-input" type="date" required>
          </label>
          <label class="profile-field" for="profile-instrument">
            <span>Instrumento *</span>
            <select id="profile-instrument" v-model="form.instrument" class="profile-input profile-select" required>
              <option value="" disabled>Escolha...</option>
              <option v-for="option in instrumentOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="profile-field" for="profile-sky-quality">
            <span>Qualidade do céu *</span>
            <select id="profile-sky-quality" v-model="form.skyQuality" class="profile-input profile-select" required>
              <option value="" disabled>Como estava o céu?</option>
              <option v-for="option in skyQualityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="profile-field" for="profile-observer-name">
            <span>Seu nome *</span>
            <input id="profile-observer-name" v-model="form.observerName" class="profile-input" maxlength="100" placeholder="Nome do observador" required>
          </label>
          <label class="profile-field" for="profile-location">
            <span>Local *</span>
            <input id="profile-location" v-model="form.location" class="profile-input" maxlength="160" placeholder="Cidade, estado ou ponto de observação" required>
          </label>
          <label class="profile-field profile-field-wide" for="profile-notes">
            <span>Anotações</span>
            <textarea id="profile-notes" v-model="form.notes" class="profile-input profile-textarea" maxlength="2000" placeholder="Detalhes como cor, brilho e o que foi observado."></textarea>
          </label>
        </div>
        <div class="profile-image-row">
          <label class="profile-upload">
            <input ref="photoInput" type="file" accept="image/*" @change="readPhoto">
            <span aria-hidden="true">＋</span> {{ form.image ? 'Trocar foto do céu' : 'Anexar foto do céu (opcional)' }}
          </label>
          <figure v-if="form.image" class="profile-preview">
            <img :src="form.image" alt="Pré-visualização da imagem selecionada">
            <button type="button" aria-label="Remover imagem selecionada" @click="clearPhoto">×</button>
          </figure>
        </div>
        <p v-if="state.error" class="profile-feedback is-error" role="alert">{{ state.error }}</p>
        <p v-else-if="state.notice" class="profile-feedback is-success" role="status">{{ state.notice }}</p>
        <button class="profile-publish" type="submit">Publicar relato</button>
      </form>
    </section>

    <section class="profile-posts" aria-labelledby="profile-posts-title">
      <div class="profile-section-heading">
        <div>
          <span class="profile-eyebrow">REGISTROS PESSOAIS</span>
          <h2 id="profile-posts-title">Meu diário de observação</h2>
        </div>
        <div class="profile-feed-controls">
          <label for="profile-filter">Filtrar por astro</label>
          <select id="profile-filter" v-model="filterAstro" class="profile-input profile-select">
            <option value="">Todos os astros</option>
            <option v-for="option in astroOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <span class="profile-post-count">{{ state.profile.posts.length }} {{ state.profile.posts.length === 1 ? 'registro' : 'registros' }}</span>
        </div>
      </div>
      <p v-if="!state.profile.posts.length" class="profile-empty">
        Seu diário está vazio. Que tal registrar sua primeira observação do céu?
      </p>
      <p v-else-if="!filteredPosts.length" class="profile-empty">
        Nenhuma observação encontrada para este astro.
      </p>
      <div v-else class="profile-post-grid">
        <article v-for="post in filteredPosts" :key="post.id" class="profile-post">
          <div class="profile-post-image">
            <img v-if="post.image" :src="post.image" :alt="'Imagem do céu: ' + astroLabel(post.astro)">
            <div v-else class="profile-post-no-image">Sem foto anexada</div>
          </div>
          <div class="profile-post-content">
            <div class="profile-post-heading">
              <h3>{{ astroLabel(post.astro) }}</h3>
              <time :datetime="post.observedAt">{{ formatDate(post.observedAt) }}</time>
            </div>
            <div class="profile-post-meta">
              <span><b>Instrumento:</b> {{ instrumentLabel(post.instrument) }}</span>
              <span><b>Qualidade do céu:</b> {{ skyQualityLabel(post.skyQuality) }}</span>
              <span><b>Observador:</b> {{ post.observerName }}</span>
              <span><b>Local:</b> {{ post.location }}</span>
            </div>
            <p v-if="post.notes" class="profile-post-story">{{ post.notes }}</p>
            <div class="profile-post-actions">
              <button type="button" :class="{ active: post.liked }" :aria-pressed="post.liked" @click="togglePost(post.id, 'liked')">
                {{ post.liked ? '♥ Gostei' : '♡ Gostei' }}
              </button>
              <button type="button" :class="{ active: post.saved }" :aria-pressed="post.saved" @click="togglePost(post.id, 'saved')">
                {{ post.saved ? 'Salvo ✓' : 'Salvar' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>`,
};
