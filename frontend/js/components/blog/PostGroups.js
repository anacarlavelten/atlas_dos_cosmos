import { computed } from 'vue';
import { ago, groupByDay, hour, now } from './format.js';
import PostImage from './PostImage.js';

export default {
  name: 'PostGroups',
  components: { PostImage },
  props: {
    posts: { type: Array, default: () => [] },
    prefix: { type: String, required: true },
  },
  setup(props) {
    const groups = computed(() => groupByDay(props.posts));
    return {
      groups,
      prefix: props.prefix,
      hour,
      ago,
      now,
    };
  },
  template: `
  <ol v-if="posts.length" class="days">
    <li v-for="group in groups" :key="group.key" :id="prefix + '-day-' + group.key" class="day">
      <h3 class="day-h"><span>{{ group.title }}</span><small v-if="group.sub">{{ group.sub }}</small></h3>
      <ol class="posts">
        <li v-for="post in group.posts" :key="post.id" class="post" :class="{ feat: post.featured }">
          <time class="when" :datetime="post.published_at" :title="ago(post.published_at, now)">{{ hour(post.published_at) }}</time>
          <span class="node" aria-hidden="true"></span>
          <article class="panel pcard">
            <a v-if="post.image_url || post.thumbnail || post.image" class="thumb" :href="post.url" target="_blank" rel="noopener">
              <PostImage :src="post.image_url" :fallback-src="post.thumbnail || post.image" :alt="'Imagem da notícia: ' + post.title" :source="post.news_site" />
            </a>
            <div class="pbody">
              <div class="pmeta"><span class="site">{{ post.news_site }}</span><span v-if="post.featured" class="tag sun">Destaque</span><span v-if="post.launches" class="tag rose">Lançamento</span><span v-if="post.events" class="tag sky">Evento</span></div>
              <h3><a :href="post.url" target="_blank" rel="noopener">{{ post.title }}</a></h3>
              <p class="clamp-3" lang="en" v-if="post.summary">{{ post.summary }}</p>
              <div class="pfoot muted"><span v-if="post.authors.length">{{ post.authors.join(', ') }} · </span>{{ ago(post.published_at, now) }}</div>
            </div>
          </article>
        </li>
      </ol>
    </li>
  </ol>`,
};
