import { createApp, ref, watch, onMounted } from 'vue';
import { api, once } from './api.js';
import { store, engineRef, raw, routeFromHash, isRouteHash, PAGES } from './store.js';
import { createEngine } from './engine/index.js';
import TopBar from './components/TopBar.js';
import SourcesPanel from './components/SourcesPanel.js';
import BodyList from './components/BodyList.js';
import BodyCard from './components/BodyCard.js';
import ControlBar, { syncControls } from './components/ControlBar.js';
import { IntroModal, ApodModal } from './components/Modals.js';
import BlogPage from './components/blog/BlogPage.js';
import LoginModal from './components/LoginModal.js';

async function boot(els) {
  store.phase = 'loading';
  try {
    store.loadingMsg = 'Conectando ao servidor…';
    const [health, levels, bodies] = await Promise.all([api.health(), api.levels(), api.bodies()]);
    store.health = health;
    store.levels = levels;
    store.bodies = raw(bodies);

    store.loadingMsg = 'Buscando dados da NASA: órbitas (JPL), asteroides (NeoWs) e exoplanetas…';
    const soft = (key, promise) => promise.catch(err => { store.errors[key] = err.message; return null; });
    const [orbits, neos, exo] = await Promise.all([
      soft('orbits', api.orbits()),
      soft('neos', once('neoWeek', api.neoWeek)),
      soft('exo', api.exoHosts()),
    ]);
    store.orbits = raw(orbits);
    store.neos = raw(neos);
    store.exo = raw(exo);

    const engine = await createEngine(
      {
        ...els,
        on: {
          select: id => { store.selectedId = id; },
          level: n => { store.level = n; store.listOpen = false; syncControls(); },
          hud: h => { store.hud = h; },
          state: s => { store.playing = s.playing; store.dir = s.dir; },
        },
      },
      { bodies, orbits, neos, exo },
      msg => { store.loadingMsg = msg; },
    );
    engineRef.current = engine;
    engine.setActive(store.view === 'sim');
    syncControls();
    store.phase = 'ready';
  } catch (err) {
    console.error(err);
    store.phase = 'error';
    store.fatal = err.message || String(err);
  }
}

const App = {
  components: { TopBar, SourcesPanel, BodyList, BodyCard, ControlBar, IntroModal, ApodModal, BlogPage, LoginModal },
  setup() {
    const canvas = ref(null), labels = ref(null), tip = ref(null), fade = ref(null);

    const requireLogin = destination => {
      if (store.page === 'perfil') store.page = 'noticias';
      store.view = 'blog';
      store.pendingAuthDestination = destination;
      store.authMode = 'login';
      store.authError = '';
      store.authModalOpen = true;
      history.replaceState(null, '', `#/${store.page}`);
    };
    const syncRoute = () => {
      if (!isRouteHash()) return;   // âncora dentro da página atual
      const route = routeFromHash();
      if ((route.view === 'sim' || route.page === 'perfil') && !store.authenticated) {
        requireLogin(route.view === 'sim' ? 'sim' : 'profile');
        return;
      }
      store.view = route.view;
      if (route.page) store.page = route.page;
      if (location.hash === '#/diario') history.replaceState(null, '', '#/perfil');
    };
    if ((store.view === 'sim' || store.page === 'perfil') && !store.authenticated) {
      requireLogin(store.view === 'sim' ? 'sim' : 'profile');
    } else if (location.hash === '#/diario') {
      history.replaceState(null, '', '#/perfil');
    }
    addEventListener('hashchange', syncRoute);
    const setTitle = () => {
      const page = PAGES.find(p => p.key === store.page);
      document.title = store.view === 'sim' ? 'Simulador · Atlas do Cosmos' : `${page?.title || 'Notícias'} · Atlas do Cosmos`;
    };
    watch(() => store.page, () => { setTitle(); scrollTo(0, 0); });
    const enter = view => {
      setTitle();
      if (view === 'sim' && store.phase === 'idle') {
        boot({ canvas: canvas.value, labelsEl: labels.value, tipEl: tip.value, fadeEl: fade.value });
      }
      engineRef.current?.setActive(view === 'sim');
      if (view !== 'sim') { store.sourcesOpen = false; store.listOpen = false; }
    };
    onMounted(() => enter(store.view));
    watch(() => store.view, enter);

    return { store, canvas, labels, tip, fade };
  },
  template: `
    <BlogPage v-show="store.view === 'blog'" />
    <div class="sim" v-show="store.view === 'sim'">
      <canvas id="gl" ref="canvas" aria-label="Simulação 3D do cosmos. Arraste para girar, role para aproximar e clique em um astro."></canvas>
      <div id="labels" ref="labels" aria-hidden="true"></div>
      <div id="fade" ref="fade"></div>
      <template v-if="store.phase === 'ready'">
        <TopBar />
        <SourcesPanel />
        <BodyList />
        <BodyCard />
        <div id="hud">
          <div>Câmera a <b>{{ store.hud.dist }}</b> do alvo</div>
          <div v-if="store.hud.date">Posições em <b>{{ store.hud.date }}</b><span v-if="store.hud.reversing"> (voltando no tempo)</span></div>
          <div class="hint" v-if="store.hud.hint">{{ store.hud.hint }}</div>
        </div>
        <ControlBar />
      </template>
      <div id="tip" ref="tip"></div>
      <IntroModal />
      <div id="load" v-if="store.phase === 'loading' || store.phase === 'error'">
        <template v-if="store.phase === 'loading'"><div class="spin"></div><div>{{ store.loadingMsg }}</div></template>
        <template v-else>
          <div class="err">Não foi possível iniciar o simulador: {{ store.fatal }}</div>
          <div>Confira se o servidor está rodando (<code>uvicorn app:app</code>) e recarregue a página.</div>
          <a class="ibtn" href="#/noticias">Voltar ao Atlas</a>
        </template>
      </div>
    </div>
    <ApodModal />
    <LoginModal />
  `,
};

createApp(App).mount('#app');
