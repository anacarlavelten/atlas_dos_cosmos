import { onMounted, ref } from 'vue';
import { api, once } from '../../api.js';
import PostImage from './PostImage.js';

export default {
  name: 'MediaStrip',
  components: { PostImage },
  props: { posts: { type: Array, default: () => [] } },
  setup() {
    const apod = ref(null);
    onMounted(() => once('apod', api.apod).then(data => { apod.value = data; }, () => {}));
    return { apod };
  },
  template: `
  <section class="media-strip" aria-label="NASA TV e atualizações rápidas">
    <div class="media-brand"><span class="media-live-dot"></span><b>NASA TV</b><small>ATUALIZAÇÕES RÁPIDAS</small></div>
    <div class="media-items">
      <a v-if="apod" class="media-item" :href="apod.page_url" target="_blank" rel="noopener">
        <span class="media-thumb-wrap">
          <PostImage class="media-thumb" :src="apod.media_type === 'video' ? apod.thumbnail_url : apod.url" :alt="'Mídia APOD: ' + apod.title" source="NASA · APOD" />
          <span class="media-play" aria-hidden="true">{{ apod.media_type === 'video' ? '▶' : '↗' }}</span>
        </span>
        <span class="media-caption"><small>NASA · APOD</small><b>{{ apod.title }}</b></span>
      </a>
      <a v-for="post in posts" :key="post.id" class="media-item" :href="post.url" target="_blank" rel="noopener">
        <span class="media-thumb-wrap">
          <PostImage class="media-thumb" :src="post.image_url" :fallback-src="post.thumbnail || post.image" :alt="'Imagem: ' + post.title" :source="post.news_site" />
          <span class="media-play" aria-hidden="true">↗</span>
        </span>
        <span class="media-caption"><small>{{ post.news_site }}</small><b>{{ post.title }}</b></span>
      </a>
      <p v-if="!apod && !posts.length" class="media-loading">Carregando atualizações espaciais…</p>
    </div>
  </section>`,
};
