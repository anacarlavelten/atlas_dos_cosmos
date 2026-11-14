import { computed } from 'vue';
import { ago, now } from './format.js';
import PostImage from './PostImage.js';

export default {
  name: 'TopStories',
  components: { PostImage },
  props: {
    posts: { type: Array, default: () => [] },
    feature: { type: Object, default: null },
  },
  setup(props) {
    const stories = computed(() => props.posts);
    return { stories, feature: computed(() => props.feature), ago, now };
  },
  template: `
  <section v-if="stories.length || feature" class="portal-card top-stories" aria-labelledby="top-stories-title">
    <div class="module-heading"><span class="eyebrow">Em pauta</span><h2 id="top-stories-title">Top histórias</h2></div>
    <ol v-if="stories.length" class="top-story-list">
      <li v-for="(post, index) in stories" :key="post.id" class="top-story">
        <a :href="post.url" target="_blank" rel="noopener" class="top-story-link">
          <PostImage class="top-story-thumb" :src="post.image_url" :fallback-src="post.thumbnail || post.image" :alt="'Imagem da história: ' + post.title" :source="post.news_site" />
          <span class="top-story-copy">
            <span class="story-tag">{{ post.featured ? 'DESTAQUE' : post.news_site }}</span>
            <b>{{ post.title }}</b>
            <small>{{ ago(post.published_at, now) }} · {{ post.news_site }}</small>
          </span>
          <span class="story-rank" aria-hidden="true">0{{ index + 1 }}</span>
        </a>
      </li>
    </ol>
    <a v-if="feature" :href="feature.url" target="_blank" rel="noopener" class="top-feature">
      <PostImage :src="feature.image_url" :fallback-src="feature.thumbnail || feature.image" :alt="'Destaque: ' + feature.title" :source="feature.news_site" />
      <span class="top-feature-shade"></span>
      <span class="top-feature-copy"><small>{{ feature.news_site }}</small><b>{{ feature.title }}</b></span>
    </a>
  </section>`,
};
