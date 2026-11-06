/* Linha do tempo: publicações da Spaceflight News API agrupadas por dia, com
   filtros de tipo (notícias, blogs, relatórios), tópico e busca. Os filtros
   disponíveis vêm de /api/blog/topics. */
import { reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { api, once } from '../../api.js';
import { groupByDay, hour, ago, now, hideBroken } from './format.js';

const PAGE = 20;
const REFRESH_MS = 5 * 60 * 1000;

export default {
  name: 'BlogTimeline',
  setup() {
    const f = reactive({ kinds: [], topics: [], kind: 'articles', topic: 'tudo', q: '', draft: '', error: null });
    const feed = reactive({ posts: [], offset: 0, total: 0, hasMore: false, loading: false, error: null, stale: false, fetchedAt: null, fresh: [] });
    let token = 0, timer = null;

    async function load(reset) {
      const my = ++token;
      if (reset) { feed.posts = []; feed.offset = 0; feed.fresh = []; }
      feed.loading = true; feed.error = null;
      try {
        const d = await api.blogFeed({ kind: f.kind, topic: f.topic, q: f.q, offset: feed.offset, limit: PAGE });
        if (my !== token) return;
        const seen = new Set(feed.posts.map(p => p.id));
        feed.posts.push(...d.posts.filter(p => !seen.has(p.id)));
        feed.offset += d.limit;
        feed.total = d.total; feed.hasMore = d.has_more; feed.stale = d.stale; feed.fetchedAt = d.fetched_at;
      } catch (e) {
        if (my === token) feed.error = e.message;
      } finally {
        if (my === token) feed.loading = false;
      }
    }

    /* A cada 5 minutos verifica se há publicações novas no topo, sem mexer na
       leitura: aparece um botão "N novas publicações". */
    async function checkFresh() {
      if (feed.loading || !feed.posts.length || document.hidden) return;
      const my = token;
      try {
        const d = await api.blogFeed({ kind: f.kind, topic: f.topic, q: f.q, offset: 0, limit: PAGE });
        if (my !== token) return;
        const seen = new Set(feed.posts.map(p => p.id));
        feed.fresh = d.posts.filter(p => !seen.has(p.id) && p.published_at > feed.posts[0].published_at);
      } catch { /* silencioso: a próxima verificação tenta de novo */ }
    }
    const showFresh = () => { feed.posts.unshift(...feed.fresh); feed.fresh = []; };

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

    const groups = computed(() => groupByDay(feed.posts));
    const topicInfo = computed(() => f.topics.find(t => t.key === f.topic));
    const kindLabel = computed(() => f.kinds.find(k => k.key === f.kind)?.label || '');
    const updated = computed(() => (feed.fetchedAt ? ago(feed.fetchedAt, now.value) : ''));

    return { f, feed, groups, topicInfo, kindLabel, updated, load, setKind, setTopic, search, clearSearch, showFresh, hour, ago, now, hideBroken };
  },
  template: `
  <section class="tl" aria-labelledby="tl-title">
    <div class="tl-head">
      <div>
        <h2 id="tl-title">Linha do tempo</h2>
        <p class="muted">Notícias de agências e veículos especializados, em ordem cronológica. Textos originais, em inglês.</p>
      </div>
      <div class="seg" role="tablist" aria-label="Tipo de publicação" v-if="f.kinds.length">
        <button v-for="k in f.kinds" :key="k.key" role="tab" :aria-selected="f.kind === k.key" :class="{ on: f.kind === k.key }" @click="setKind(k.key)">{{ k.label }}</button>
      </div>
    </div>

    <div class="filters">
      <div class="chips" role="group" aria-label="Tópicos" v-if="f.topics.length">
        <button v-for="t in f.topics" :key="t.key" class="fchip" :class="{ on: f.topic === t.key }" :aria-pressed="f.topic === t.key" :title="t.description" @click="setTopic(t.key)">{{ t.label }}</button>
      </div>
      <form class="search" role="search" @submit.prevent="search">
        <input v-model="f.draft" type="search" maxlength="80" placeholder="Buscar (ex.: Artemis, Starship, Webb)" aria-label="Buscar publicações">
        <button v-if="f.q" type="button" class="sm" @click="clearSearch">Limpar</button>
        <button type="submit" class="sm">Buscar</button>
      </form>
    </div>
    <p class="muted fnote" v-if="f.error">Filtros indisponíveis: {{ f.error }}</p>

    <div class="tl-status muted" v-if="feed.total && !feed.error">
      <span>{{ feed.total.toLocaleString('pt-BR') }} {{ kindLabel.toLowerCase() }}<template v-if="topicInfo && topicInfo.key !== 'tudo'"> sobre {{ topicInfo.label.toLowerCase() }}</template><template v-if="f.q"> com “{{ f.q }}”</template></span>
      <span v-if="updated">· atualizado {{ updated }}</span>
      <span v-if="feed.stale" class="warn">· a fonte não respondeu, exibindo dados guardados</span>
    </div>

    <button v-if="feed.fresh.length" class="fresh" @click="showFresh">
      {{ feed.fresh.length === 1 ? '1 nova publicação' : feed.fresh.length + ' novas publicações' }} ↑
    </button>

    <div class="tl-empty panel" v-if="feed.error && !feed.posts.length">
      <b>Não foi possível carregar a linha do tempo.</b>
      <p class="muted">{{ feed.error }}</p>
      <button class="sm" @click="load(true)">Tentar de novo</button>
    </div>
    <div class="tl-empty panel" v-else-if="!feed.loading && !feed.posts.length">
      <b>Nenhuma publicação encontrada.</b>
      <p class="muted">Tente outro tópico ou outra busca.</p>
    </div>

    <ol class="days">
      <li v-for="g in groups" :key="g.key" class="day">
        <h3 class="day-h"><span>{{ g.title }}</span><small v-if="g.sub">{{ g.sub }}</small></h3>
        <ol class="posts">
          <li v-for="p in g.posts" :key="p.id" class="post" :class="{ feat: p.featured }">
            <time class="when" :datetime="p.published_at" :title="ago(p.published_at, now)">{{ hour(p.published_at) }}</time>
            <span class="node" aria-hidden="true"></span>
            <article class="panel pcard">
              <div class="pbody">
                <div class="pmeta">
                  <span class="site">{{ p.news_site }}</span>
                  <span v-if="p.featured" class="tag sun">Destaque</span>
                  <span v-if="p.launches" class="tag rose">Lançamento</span>
                  <span v-if="p.events" class="tag sky">Evento</span>
                </div>
                <h4><a :href="p.url" target="_blank" rel="noopener">{{ p.title }}</a></h4>
                <p class="clamp-3" lang="en" v-if="p.summary">{{ p.summary }}</p>
                <div class="pfoot muted">
                  <span v-if="p.authors.length">{{ p.authors.join(', ') }} · </span>{{ ago(p.published_at, now) }}
                </div>
              </div>
              <a v-if="p.image_url" class="thumb" data-img :href="p.url" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
                <img :src="p.image_url" alt="" loading="lazy" @error="hideBroken">
              </a>
            </article>
          </li>
        </ol>
      </li>
    </ol>

    <div class="tl-loading" v-if="feed.loading">
      <div v-for="n in (feed.posts.length ? 2 : 5)" :key="n" class="panel pcard skel-card"><div class="skel"></div><div class="skel"></div></div>
    </div>
    <div class="more" v-if="feed.posts.length && !feed.loading">
      <p class="muted" v-if="feed.error">{{ feed.error }}</p>
      <button v-if="feed.hasMore" class="sm big" @click="load(false)">Carregar publicações anteriores</button>
      <p v-else class="muted">Você chegou ao fim da linha do tempo.</p>
    </div>
  </section>`,
};
