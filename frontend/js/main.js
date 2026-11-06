/* Ponto de entrada do frontend (Vue 3, sem etapa de build).

   O Atlas tem duas abas:
   - Blog (página inicial): linha do tempo de notícias do espaço e da tecnologia
     espacial, vindas das APIs abertas por meio do backend.
   - Simulador: o cosmos em 3D. Ele só é carregado na primeira vez que a aba é
     aberta e fica pausado enquanto o visitante está no blog.

   Carga do simulador:
   1. Busca no backend o catálogo e os dados da NASA (órbitas, asteroides, exoplanetas).
   2. Cria o motor 3D com esses dados.
   3. Liga os eventos do motor ao estado reativo que os componentes exibem. */
import { createApp, ref, watch, onMounted } from 'vue';
import { api, once } from './api.js';
import { store, engineRef, raw, viewFromHash } from './store.js';
import { createEngine } from './engine/index.js';
import TopBar from './components/TopBar.js';
import SourcesPanel from './components/SourcesPanel.js';
import BodyList from './components/BodyList.js';
import BodyCard from './components/BodyCard.js';
import ControlBar, { syncControls } from './components/ControlBar.js';
import { IntroModal, ApodModal } from './components/Modals.js';
import BlogPage from './components/blog/BlogPage.js';

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
      soft('neos', once('neoWeek', api.neoWeek)),   // compartilhado com o blog
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
  components: { TopBar, SourcesPanel, BodyList, BodyCard, ControlBar, IntroModal, ApodModal, BlogPage },
  setup() {
    const canvas = ref(null), labels = ref(null), tip = ref(null), fade = ref(null);

    addEventListener('hashchange', () => { store.view = viewFromHash(); });
    const enter = view => {
      document.title = view === 'sim' ? 'Simulador · Atlas do Cosmos' : 'Atlas do Cosmos · Blog do espaço';
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
          <a class="ibtn" href="#/blog">Voltar ao blog</a>
        </template>
      </div>
    </div>
    <ApodModal />
  `,
};

createApp(App).mount('#app');
