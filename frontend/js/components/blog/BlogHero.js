import { computed, onMounted, ref } from 'vue';
import { api, once } from '../../api.js';
import { store } from '../../store.js';
import { ago, dateLong, now } from './format.js';
import PostImage from './PostImage.js';

export default {
  name: 'BlogHero',
  components: { PostImage },
  props: {
    lead: { type: Object, default: null },
    sideStories: { type: Array, default: () => [] },
    relatedStories: { type: Array, default: () => [] },
  },
  setup(props) {
    const apod = ref(null);
    const apodError = ref('');
    const apodImage = computed(() => apod.value?.media_type === 'video'
      ? apod.value.thumbnail_url
      : apod.value?.url);
    /* A Spaceflight News republica a APOD como notícia ("APOD: 2026 November 16 – …").
       Quando a APOD já está no destaque, essa notícia não aparece de novo ao lado. */
    const repeatsApod = post => Boolean(apod.value?.title && post?.title?.includes(apod.value.title));
    const visibleSideStories = computed(() => apod.value && props.lead
      ? [props.lead, ...props.sideStories].filter(post => post && !repeatsApod(post)).slice(0, 2)
      : props.sideStories);

    onMounted(() => {
      once('apod', api.apod).then(data => { apod.value = data; }, err => { apodError.value = err.message; });
    });

    return {
      store, apod, apodError, apodImage, lead: computed(() => props.lead),
      sideStories: visibleSideStories,
      relatedStories: computed(() => props.relatedStories),
      ago, now, dateLong,
    };
  },
  template: `
  <section class="portal-hero" aria-label="Destaques">
    <div class="hero-main-column">
      <article class="hero-lead">
        <template v-if="apod">
          <PostImage class="hero-background" :src="apodImage" :alt="'Imagem astronômica do dia: ' + apod.title" source="NASA · APOD" loading="eager" fetchpriority="high" />
          <div class="hero-shade"></div>
          <div class="hero-copy">
            <span class="hero-category">NASA · IMAGEM DO DIA</span>
            <h1>{{ apod.title }}</h1>
            <p class="hero-summary">{{ apod.explanation }}</p>
            <div class="hero-byline">
              <span>{{ dateLong(apod.date) }}</span>
              <span>{{ apod.copyright || 'NASA APOD' }}</span>
              <span>{{ apod.stale ? 'Dados em cache' : 'Atualizado hoje' }}</span>
            </div>
            <a class="hero-cta" :href="apod.media_type === 'video' ? apod.url : (apod.hdurl || apod.url)" target="_blank" rel="noopener">
              {{ apod.media_type === 'video' ? 'Assistir à publicação' : 'Explorar a imagem' }} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </template>
        <template v-else-if="lead">
          <PostImage class="hero-background" :src="lead.image_url" :fallback-src="lead.thumbnail || lead.image" :alt="'Imagem da notícia: ' + lead.title" :source="lead.news_site" loading="eager" fetchpriority="high" />
          <div class="hero-shade"></div>
          <div class="hero-copy">
            <span class="hero-category">{{ lead.news_site }} · DESTAQUE</span>
            <h1>{{ lead.title }}</h1>
            <p v-if="lead.summary" class="hero-summary">{{ lead.summary }}</p>
            <div class="hero-byline"><span>{{ ago(lead.published_at, now) }}</span><span>{{ lead.news_site }}</span><span>NASA APOD indisponível</span></div>
            <a class="hero-cta" :href="lead.url" target="_blank" rel="noopener">Ler a notícia <span aria-hidden="true">↗</span></a>
          </div>
        </template>
        <div v-else-if="apodError" class="hero-error" role="status">
          <span class="hero-category">NASA · IMAGEM DO DIA</span>
          <h1>O espaço, em perspectiva</h1>
          <p>{{ apodError }}</p>
        </div>
        <div v-else class="hero-skeleton" aria-label="Carregando destaque"></div>
      </article>
      <div v-if="relatedStories.length" class="related-stories" aria-label="Notícias relacionadas">
        <a v-for="post in relatedStories" :key="post.id" :href="post.url" target="_blank" rel="noopener" class="related-story">
          <small>{{ post.featured ? 'DESTAQUE' : post.news_site }}</small>
          <b>{{ post.title }}</b>
          <time :datetime="post.published_at">{{ ago(post.published_at, now) }}</time>
        </a>
      </div>
    </div>
    <div class="hero-side-column">
      <a v-for="post in sideStories" :key="post.id" class="hero-side-card" :href="post.url" target="_blank" rel="noopener">
        <PostImage :src="post.image_url" :fallback-src="post.thumbnail || post.image" :alt="'Imagem da notícia: ' + post.title" :source="post.news_site" />
        <span class="hero-side-shade"></span>
        <span class="hero-category">{{ post.news_site }}</span>
        <b>{{ post.title }}</b>
        <time :datetime="post.published_at">{{ ago(post.published_at, now) }}</time>
      </a>
    </div>
  </section>`,
};
