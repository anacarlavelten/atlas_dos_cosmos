/* Layout das páginas do Atlas: cabeçalho com a navegação, a página aberta e o
   rodapé. Cada item da navegação abre uma página própria (#/noticias, #/ceu...);
   as páginas visitadas ficam em memória (KeepAlive) para não recarregar os dados. */
import { computed, nextTick, onMounted, watch } from 'vue';
import { PAGES, store } from '../../store.js';
import { now } from './format.js';
import BirthSkyCard from './BirthSkyCard.js';
import LaunchesList from './LaunchesList.js';
import NasaTechnologies from './NasaTechnologies.js';
import NearAsteroids from './NearAsteroids.js';
import NewsPage from './NewsPage.js';
import ObservationDiary from './ObservationDiary.js';

const COMPONENTS = {
  noticias: NewsPage,
  lancamentos: LaunchesList,
  ceu: BirthSkyCard,
  asteroides: NearAsteroids,
  tecnologias: NasaTechnologies,
  diario: ObservationDiary,
};

export default {
  name: 'BlogPage',
  setup() {
    const clock = computed(() => new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(now.value));
    const current = computed(() => COMPONENTS[store.page] || NewsPage);

    /* A busca fica no arquivo de notícias: abre a página de notícias e leva até ela. */
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
    onMounted(revealActive);
    watch(() => store.page, revealActive);

    return { store, PAGES, clock, current, openSearch };
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
          <a v-for="page in PAGES" :key="page.key" :href="'#/' + page.key"
             :class="{ active: store.page === page.key }" :aria-current="store.page === page.key ? 'page' : null">{{ page.label }}</a>
          <a class="bnav-sim" href="#/simulador">Simulador 3D <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>
    <main class="bwrap editorial" :class="'page-' + store.page">
      <KeepAlive>
        <component :is="current" :key="store.page" />
      </KeepAlive>
    </main>
    <footer class="bfoot">
      <div class="bwrap">
        <nav class="footer-nav" aria-label="Links de rodapé">
          <a v-for="page in PAGES" :key="page.key" :href="'#/' + page.key">{{ page.label }}</a><a href="#/simulador">Simulador</a>
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
