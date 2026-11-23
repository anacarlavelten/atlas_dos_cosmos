import { reactive, computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { api, once } from '../../api.js';
import { ago, now } from './format.js';
import PostImage from './PostImage.js';
import PostGroups from './PostGroups.js';
import StoryRow from './StoryRow.js';
import TopStories from './TopStories.js';
import { deduplicatePosts, distributeFeed } from './useFeedDistribution.js';
import { useImageHealth } from './useImageHealth.js';

const PAGE = 20;
const INITIAL_PAGE = 40;
const INITIAL_POOL = 60;
const LATEST_INITIAL = 12;
const LATEST_BATCH = 9;
const ARCHIVE_PAGE = 20;
const REFRESH_MS = 5 * 60 * 1000;

export default {
  name: 'BlogTimeline',
  components: { PostImage, PostGroups, StoryRow, TopStories },
  emits: ['distribution-update'],
  setup(_props, { emit }) {
    const f = reactive({ kinds: [], topics: [], kind: 'articles', topic: 'tudo', q: '', draft: '', error: null });
    const feed = reactive({ posts: [], offset: 0, total: 0, hasMore: false, loading: false, error: null, stale: false, fetchedAt: null, fresh: [] });
    const imageHealth = useImageHealth();
    const latestVisible = ref(LATEST_INITIAL);
    const archiveVisible = ref(ARCHIVE_PAGE);
    let token = 0, timer = null;
    const distribution = computed(() => distributeFeed(feed.posts, latestVisible.value, imageHealth.failedUrls.value));
    watch(distribution, value => emit('distribution-update', value), { immediate: true });

    async function load(reset) {
      const my = ++token;
      if (reset) {
        feed.posts = []; feed.offset = 0; feed.fresh = [];
        latestVisible.value = LATEST_INITIAL;
        archiveVisible.value = ARCHIVE_PAGE;
      }
      feed.loading = true; feed.error = null;
      try {
        let limit = reset ? INITIAL_PAGE : PAGE;
        do {
          let d;
          try {
            d = await api.blogFeed({ kind: f.kind, topic: f.topic, q: f.q, offset: feed.offset, limit });
          } catch (error) {
            if (!reset || feed.offset !== 0 || limit !== INITIAL_PAGE) throw error;
            limit = PAGE;
            d = await api.blogFeed({ kind: f.kind, topic: f.topic, q: f.q, offset: feed.offset, limit });
          }
          if (my !== token) return;
          feed.posts = deduplicatePosts([...feed.posts, ...d.posts]);
          feed.offset += d.limit;
          feed.total = d.total; feed.hasMore = d.has_more; feed.stale = d.stale; feed.fetchedAt = d.fetched_at;
          if (!reset || feed.posts.length >= INITIAL_POOL || !feed.hasMore || !d.posts.length) break;
          limit = Math.min(PAGE, INITIAL_POOL - feed.posts.length);
        } while (limit > 0);
      } catch (e) {
        if (my === token) feed.error = e.message;
      } finally {
        if (my === token) feed.loading = false;
      }
    }

    async function checkFresh() {
      if (feed.loading || !feed.posts.length || document.hidden) return;
      const my = token;
      try {
        const d = await api.blogFeed({ kind: f.kind, topic: f.topic, q: f.q, offset: 0, limit: PAGE });
        if (my !== token) return;
        const existing = deduplicatePosts(feed.posts);
        const existingIds = new Set(existing.map(post => post.id));
        const unique = deduplicatePosts([...existing, ...d.posts]);
        feed.fresh = unique.filter(post => !existingIds.has(post.id)
          && post.published_at > feed.posts[0].published_at);
      } catch {  }
    }

    const showFresh = () => {
      feed.posts = deduplicatePosts([...feed.fresh, ...feed.posts]);
      feed.fresh = [];
    };

    onMounted(async () => {
      load(true);
      timer = setInterval(checkFresh, REFRESH_MS);
      try {
        const t = await once('blogTopics', api.blogTopics);
        f.kinds = t.kinds; f.topics = t.topics;
      } catch (e) { f.error = e.message; }
    });
    onBeforeUnmount(() => clearInterval(timer));

    const setKind = k => { if (f.kind !== k) { f.kind = k; load(true); } };
    const setTopic = k => { if (f.topic !== k) { f.topic = k; load(true); } };
    const search = () => { const q = f.draft.trim(); if (q !== f.q) { f.q = q; load(true); } };
    const clearSearch = () => { f.draft = ''; if (f.q) { f.q = ''; load(true); } };
    const latestGroups = computed(() => distribution.value.latest);
    const archivePosts = computed(() => distribution.value.archive.slice(0, archiveVisible.value));
    const archiveGroups = computed(() => archivePosts.value);
    const latestHasMore = computed(() => distribution.value.archive.length > 0 || feed.hasMore);
    const archiveHasMore = computed(() => distribution.value.archive.length > archiveVisible.value || feed.hasMore);
    const topicInfo = computed(() => f.topics.find(t => t.key === f.topic));
    const kindLabel = computed(() => f.kinds.find(k => k.key === f.kind)?.label || '');
    const updated = computed(() => (feed.fetchedAt ? ago(feed.fetchedAt, now.value) : ''));
    const highlight = computed(() => distribution.value.dailyFeature);
    const bannerMedia = computed(() => distribution.value.bannerMedia);
    const topStories = computed(() => distribution.value.topStories);
    const topFeature = computed(() => distribution.value.topFeature);
    const storyTexts = computed(() => distribution.value.storyTexts);
    const storyCards = computed(() => distribution.value.storyCards);
    function loadMoreLatest() {
      latestVisible.value += LATEST_BATCH;
      if (!distribution.value.archive.length && feed.hasMore) load(false);
    }

    function loadMoreArchive() {
      archiveVisible.value += ARCHIVE_PAGE;
      if (distribution.value.archive.length <= archiveVisible.value && feed.hasMore) load(false);
    }

    return {
      f, feed, distribution, latestGroups, archiveGroups, latestHasMore, archiveHasMore,
      topicInfo, kindLabel, updated, highlight, bannerMedia,
      topStories, topFeature, storyTexts, storyCards,
      load, setKind, setTopic, search, clearSearch, showFresh, loadMoreLatest, loadMoreArchive,
      ago, now,
    };
  },
  template: `
  <div class="portal-content">
    <section class="topic-panel" aria-label="Tópicos de notícias">
      <div class="topic-panel-heading"><span class="eyebrow">Explore o universo</span><h2>Temas em destaque</h2></div>
      <nav class="topic-pills" role="group" aria-label="Filtrar notícias por tópico" v-if="f.topics.length">
        <button v-for="topic in f.topics" :key="topic.key" type="button" class="topic-pill" :class="{ active: f.topic === topic.key }" :aria-pressed="f.topic === topic.key" :title="topic.description" @click="setTopic(topic.key)">#{{ topic.label }}</button>
      </nav>
      <p v-else-if="f.error" class="module-error" role="alert">Tópicos indisponíveis: {{ f.error }}</p>
    </section>

    <div class="news-grid" :class="{ 'without-highlight': !highlight }">
      <TopStories :posts="topStories" :feature="topFeature" />
      <article v-if="highlight" class="daily-highlight">
        <PostImage :src="highlight.image_url" :fallback-src="highlight.thumbnail || highlight.image" :alt="'Imagem do destaque: ' + highlight.title" :source="highlight.news_site" />
        <span class="daily-shade"></span>
        <div class="daily-copy"><span class="eyebrow">Destaque do dia · {{ highlight.news_site }}</span><h2>{{ highlight.title }}</h2><a :href="highlight.url" target="_blank" rel="noopener" class="pill-primary">Ler a notícia ↗</a></div>
      </article>
    </div>

    <div v-if="bannerMedia.length" class="banner-media-row" aria-label="Imagens das últimas publicações">
      <a v-for="post in bannerMedia" :key="post.id" :href="post.url" target="_blank" rel="noopener" class="banner-media-card">
        <PostImage :src="post.image_url" :fallback-src="post.thumbnail || post.image" :alt="'Imagem da publicação: ' + post.title" :source="post.news_site" /><span>{{ post.news_site }} · {{ post.title }}</span>
      </a>
    </div>

    <StoryRow
      :text-posts="storyTexts"
      :card-posts="storyCards"
      :has-more="latestHasMore"
      :loading="feed.loading"
      @load-more="loadMoreLatest"
    />

    <section id="latest-stories" class="archive-section latest-section" aria-labelledby="latest-title">
      <div class="archive-heading">
        <div><span class="eyebrow">Em ordem cronológica</span><h2 id="latest-title">Últimas</h2><p>As publicações mais recentes ainda não exibidas nos destaques.</p></div>
      </div>
      <p class="tl-empty panel" v-if="feed.error && !feed.posts.length" role="alert">
        <b>Não foi possível carregar as últimas notícias.</b><span>{{ feed.error }}</span>
        <button class="sm" type="button" @click="load(true)">Tentar de novo</button>
      </p>
      <p class="tl-empty panel" v-else-if="!feed.loading && !latestGroups.length">
        <b>Nenhuma publicação restante neste recorte.</b><span>Tente outro tópico ou outra busca.</span>
      </p>
      <PostGroups :posts="latestGroups" prefix="latest" />
      <div class="tl-loading" v-if="feed.loading && !latestGroups.length"><div v-for="n in 3" :key="n" class="panel pcard skel-card"><div class="skel"></div><div class="skel"></div></div></div>
      <div class="more" v-if="latestGroups.length">
        <button v-if="latestHasMore" class="sm big" type="button" :disabled="feed.loading" @click="loadMoreLatest">Carregar mais</button>
        <p v-else class="muted">Você chegou ao fim das últimas publicações deste recorte.</p>
      </div>
    </section>

    <section id="all-stories" class="archive-section" aria-labelledby="archive-title">
      <div class="archive-heading">
        <div><span class="eyebrow">Arquivo editorial</span><h2 id="archive-title">Todas as notícias</h2><p>Publicações em ordem cronológica. Os textos originais são mantidos no idioma da fonte.</p></div>
        <div class="seg" role="tablist" aria-label="Tipo de publicação" v-if="f.kinds.length">
          <button v-for="kind in f.kinds" :key="kind.key" type="button" role="tab" :aria-selected="f.kind === kind.key" :class="{ on: f.kind === kind.key }" @click="setKind(kind.key)">{{ kind.label }}</button>
        </div>
      </div>
      <div class="archive-filters">
        <form class="search" role="search" @submit.prevent="search">
          <input v-model="f.draft" type="search" maxlength="80" placeholder="Buscar (ex.: Artemis, Starship, Webb)" aria-label="Buscar publicações">
          <button v-if="f.q" type="button" class="sm" @click="clearSearch">Limpar</button>
          <button type="submit" class="sm">Buscar</button>
        </form>
        <span class="muted archive-topic" v-if="topicInfo">Tópico: #{{ topicInfo.label }}</span>
      </div>
      <p class="muted fnote" v-if="f.error" role="alert">Filtros indisponíveis: {{ f.error }}</p>
      <div class="tl-status muted" v-if="feed.total && !feed.error">
        <span>{{ feed.total.toLocaleString('pt-BR') }} {{ kindLabel.toLowerCase() }}<template v-if="topicInfo && topicInfo.key !== 'tudo'"> sobre {{ topicInfo.label.toLowerCase() }}</template><template v-if="f.q"> com “{{ f.q }}”</template></span>
        <span v-if="updated">· atualizado {{ updated }}</span>
        <span v-if="feed.stale" class="warn">· a fonte não respondeu, exibindo dados guardados</span>
      </div>
      <button v-if="feed.fresh.length" class="fresh" type="button" @click="showFresh">
        {{ feed.fresh.length === 1 ? '1 nova publicação' : feed.fresh.length + ' novas publicações' }} ↑
      </button>
      <div class="tl-empty panel" v-if="feed.error && !feed.posts.length">
        <b>Não foi possível carregar a linha do tempo.</b><p class="muted">{{ feed.error }}</p>
        <button class="sm" type="button" @click="load(true)">Tentar de novo</button>
      </div>
      <div class="tl-empty panel" v-else-if="!feed.loading && !feed.posts.length">
        <b>Nenhuma publicação encontrada.</b><p class="muted">Tente outro tópico ou outra busca.</p>
      </div>
      <PostGroups :posts="archiveGroups" prefix="archive" />
      <div class="tl-loading" v-if="feed.loading"><div v-for="n in (feed.posts.length ? 2 : 5)" :key="n" class="panel pcard skel-card"><div class="skel"></div><div class="skel"></div></div></div>
      <div class="more" v-if="archiveGroups.length && !feed.loading">
        <p class="muted" v-if="feed.error" role="alert">{{ feed.error }}</p>
        <button v-if="archiveHasMore" class="sm big" type="button" @click="loadMoreArchive">Carregar publicações anteriores</button>
        <p v-else class="muted">Você chegou ao fim da linha do tempo.</p>
      </div>
    </section>
  </div>`,
};
