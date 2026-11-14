import { ago, now } from './format.js';
import PostImage from './PostImage.js';

export default {
  name: 'StoryRow',
  components: { PostImage },
  props: {
    textPosts: { type: Array, default: () => [] },
    cardPosts: { type: Array, default: () => [] },
    hasMore: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },
  emits: ['load-more'],
  setup() { return { ago, now }; },
  template: `
  <section v-if="textPosts.length || cardPosts.length" id="stories" class="story-shelf" aria-labelledby="stories-title">
    <div class="section-heading"><div><span class="eyebrow">Notícias em movimento</span><h2 id="stories-title">Histórias do espaço</h2></div><a href="#all-stories">Ver todas as notícias ↓</a></div>
    <div class="story-row" aria-label="Leituras rápidas">
      <a v-for="post in textPosts" :key="'row-' + post.id" class="story-row-item" :href="post.url" target="_blank" rel="noopener">
        <PostImage class="story-row-thumb" :src="post.image_url" :fallback-src="post.thumbnail || post.image" :alt="'Imagem: ' + post.title" :source="post.news_site" />
        <span><small>{{ post.news_site }} · {{ ago(post.published_at, now) }}</small><b>{{ post.title }}</b></span>
      </a>
    </div>
    <div class="story-cards" aria-label="Mais notícias">
      <a v-for="post in cardPosts" :key="'card-' + post.id" class="story-card" :href="post.url" target="_blank" rel="noopener">
        <PostImage :src="post.image_url" :fallback-src="post.thumbnail || post.image" :alt="'Imagem da notícia: ' + post.title" :source="post.news_site" />
        <span class="story-card-shade"></span>
        <span class="story-card-copy"><small>{{ post.featured ? 'DESTAQUE' : post.news_site }}</small><b>{{ post.title }}</b><time :datetime="post.published_at">{{ ago(post.published_at, now) }}</time></span>
      </a>
    </div>
    <button v-if="hasMore" class="pill-secondary shelf-more" type="button" :disabled="loading" @click="$emit('load-more')">{{ loading ? 'Carregando…' : 'Mais histórias' }}</button>
    <p v-else-if="textPosts.length || cardPosts.length" class="module-muted shelf-end">Você está vendo as histórias disponíveis neste recorte.</p>
  </section>`,
};
