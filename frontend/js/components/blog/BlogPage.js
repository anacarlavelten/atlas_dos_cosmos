import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { PAGES, store } from '../../store.js';
import { now } from './format.js';
import BirthSkyCard from './BirthSkyCard.js';
import LaunchesList from './LaunchesList.js';
import NasaTechnologies from './NasaTechnologies.js';
import NearAsteroids from './NearAsteroids.js';
import NewsPage from './NewsPage.js';
import ProfilePage from './ProfilePage.js';

const COMPONENTS = {
  noticias: NewsPage,
  lancamentos: LaunchesList,
  ceu: BirthSkyCard,
  asteroides: NearAsteroids,
  tecnologias: NasaTechnologies,
  perfil: ProfilePage,
};

export default {
  name: 'BlogPage',
  setup() {
    let scrollPromptShown = false;
    const clock = computed(() => new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(now.value));
    const current = computed(() => COMPONENTS[store.page] || NewsPage);

    function gateMore(event) {
      if (store.authenticated) return;
      const control = event.target.closest('a, button');
      if (!control) return;
      const label = `${control.textContent || ''} ${control.getAttribute('aria-label') || ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (!/\b(mais noticias|mais historias|mais informacoes|carregar mais|carregar publicacoes anteriores|ver mais observacoes|ver todas as noticias)\b/.test(label)) return;
      event.preventDefault();
      event.stopPropagation();
      store.authMode = 'register';
      store.authError = '';
      store.pendingAuthDestination = null;
      store.authModalOpen = true;
    }

    function checkScrollGate(event) {
      const blog = event.currentTarget;
      const scrollableDistance = blog.scrollHeight - blog.clientHeight;
      if (scrollPromptShown || store.view !== 'blog' || store.authenticated
        || store.authModalOpen || scrollableDistance <= 0
        || blog.scrollTop / scrollableDistance < 0.4) return;
      scrollPromptShown = true;
      store.authMode = 'register';
      store.authError = '';
      store.pendingAuthDestination = null;
      store.authModalOpen = true;
    }

    function openSearch() {
      const focus = () => nextTick(() => {
        document.getElementById('all-stories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelector('#all-stories input[type=search]')?.focus({ preventScroll: true });
      });
      if (store.page === 'noticias' && store.view === 'blog') return focus();
      addEventListener('hashchange', () => setTimeout(focus, 50), { once: true });
      location.hash = '#/noticias';
    }

    /* No celular a navegação rola na horizontal: mantém a aba aberta visível. */
    const revealActive = () => nextTick(() => {
      const nav = document.querySelector('.bnav');
      const link = nav?.querySelector('a.active');
      if (nav && link) nav.scrollLeft = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    });
    onMounted(() => {
      revealActive();
      document.getElementById('blog')?.addEventListener('scroll', checkScrollGate, { passive: true });
    });
    onBeforeUnmount(() => document.getElementById('blog')?.removeEventListener('scroll', checkScrollGate));
    watch(() => store.page, page => {
      revealActive();
      if (page === 'perfil') nextTick(() => document.getElementById('blog')?.scrollTo(0, 0));
    });

    return { store, PAGES, clock, current, openSearch, gateMore };
  },
  template: `
  <div id="blog">
    <header class="bhead" id="inicio">
      <div class="bhead-top">
        <div class="bhead-main">
          <a class="brand" href="#/noticias" aria-label="Atlas do Cosmos, página inicial">Atlas do <b>Cosmos</b></a>
          <div class="header-clock" aria-label="Localização e hora atual">
            <span class="eyebrow">OBSERVATÓRIO · TERRA</span>
            <time>{{ clock }}</time>
          </div>
          <div class="header-actions">
            <a href="#/noticias" @click.prevent="openSearch" aria-label="Buscar nas notícias"><span aria-hidden="true">⌕</span></a>
          </div>
        </div>
        <nav class="bnav" aria-label="Páginas do Atlas">
          <template v-for="page in PAGES" :key="page.key">
            <a v-if="page.key !== 'perfil' || store.authenticated" :href="'#/' + page.key"
               :class="{ active: store.page === page.key }" :aria-current="store.page === page.key ? 'page' : null">{{ page.label }}</a>
          </template>
          <a class="bnav-sim" href="#/simulador">Simulador 3D <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>
    <main class="bwrap editorial" :class="'page-' + store.page" @click.capture="gateMore">
      <KeepAlive>
        <component :is="current" :key="store.page" />
      </KeepAlive>
    </main>
    <footer class="bfoot">
      <div class="bwrap">
        <nav class="footer-nav" aria-label="Links de rodapé">
          <template v-for="page in PAGES" :key="page.key">
            <a v-if="page.key !== 'perfil' || store.authenticated" :href="'#/' + page.key">{{ page.label }}</a>
          </template><a href="#/simulador">Simulador</a>
        </nav>
        <b>Fontes de dados</b>
        <p class="muted">
          Publicações: <a href="https://spaceflightnewsapi.net" target="_blank" rel="noopener">Spaceflight News API</a> ·
          Lançamentos: <a href="https://thespacedevs.com/llapi" target="_blank" rel="noopener">Launch Library 2 (The Space Devs)</a> ·
          Imagem do dia: <a href="https://apod.nasa.gov" target="_blank" rel="noopener">NASA APOD</a> ·
          Asteroides: <a href="https://api.nasa.gov" target="_blank" rel="noopener">NASA NeoWs</a> ·
          Tecnologias: <a href="https://technology.nasa.gov" target="_blank" rel="noopener">NASA Technology Transfer</a>.
          As respostas ficam em cache no servidor do Atlas; os textos das publicações são os originais de cada site.
        </p>
      </div>
    </footer>
  </div>`,
};
