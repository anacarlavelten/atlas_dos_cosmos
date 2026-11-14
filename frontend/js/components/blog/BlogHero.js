import { computed, onMounted, ref } from 'vue';
import { api, once } from '../../api.js';
import { store } from '../../store.js';
import { ago, dateLong, now } from './format.js';
import LaunchCountdown from './LaunchCountdown.js';
import { futureLaunches } from './launches.js';
import PostImage from './PostImage.js';

export default {
  name: 'BlogHero',
  components: { LaunchCountdown, PostImage },
  props: {
    lead: { type: Object, default: null },
    sideStories: { type: Array, default: () => [] },
    relatedStories: { type: Array, default: () => [] },
  },
  setup(props) {
    const apod = ref(null);
    const apodError = ref('');
    const launches = ref([]);
    const launchError = ref('');
    const upcomingLaunches = computed(() => futureLaunches(launches.value, now.value));
    const nextLaunch = computed(() => upcomingLaunches.value.find(launch => launch.net) || upcomingLaunches.value[0] || null);
    const apodImage = computed(() => apod.value?.media_type === 'video'
      ? apod.value.thumbnail_url
      : apod.value?.url);
    const visibleSideStories = computed(() => apod.value && props.lead
      ? [props.lead, props.sideStories[0]].filter(Boolean)
      : props.sideStories);

    onMounted(() => {
      once('apod', api.apod).then(data => { apod.value = data; }, err => { apodError.value = err.message; });
      once('launches', api.blogLaunches).then(data => { launches.value = data.launches || []; }, err => { launchError.value = err.message; });
    });

    return {
      store, apod, apodError, apodImage, lead: computed(() => props.lead),
      sideStories: visibleSideStories,
      relatedStories: computed(() => props.relatedStories), nextLaunches: upcomingLaunches, nextLaunch, launchError,
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
          <p v-if="launchError">{{ launchError }}</p>
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
      <p v-if="!sideStories.length && !nextLaunches.length && launchError" class="hero-side-empty">{{ launchError }}</p>
    </div>
    <LaunchCountdown v-if="nextLaunch" class="hero-launch-countdown" :launch="nextLaunch" variant="detailed" />
  </section>`,
};
