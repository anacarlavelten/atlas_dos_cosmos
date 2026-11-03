/* Ponto de entrada do frontend (Vue 3, sem etapa de build).

   1. Busca no backend o catálogo e os dados da NASA (órbitas, asteroides, exoplanetas).
   2. Cria o motor 3D com esses dados.
   3. Liga os eventos do motor ao estado reativo que os componentes exibem. */
import { createApp, ref, onMounted } from 'vue';
import { api } from './api.js';
import { store, engineRef, raw } from './store.js';
import { createEngine } from './engine/index.js';
import TopBar from './components/TopBar.js';
import SourcesPanel from './components/SourcesPanel.js';
import BodyList from './components/BodyList.js';
import BodyCard from './components/BodyCard.js';
import ControlBar, { syncControls } from './components/ControlBar.js';
import { IntroModal, ApodModal } from './components/Modals.js';

async function boot(els) {
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
      soft('neos', api.neoWeek()),
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
    syncControls();
    store.phase = 'ready';
  } catch (err) {
    console.error(err);
    store.phase = 'error';
    store.fatal = err.message || String(err);
  }
}

const App = {
  components: { TopBar, SourcesPanel, BodyList, BodyCard, ControlBar, IntroModal, ApodModal },
  setup() {
    const canvas = ref(null), labels = ref(null), tip = ref(null), fade = ref(null);
    onMounted(() => boot({ canvas: canvas.value, labelsEl: labels.value, tipEl: tip.value, fadeEl: fade.value }));
    return { store, canvas, labels, tip, fade };
  },
  template: `
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
    <ApodModal />
    <div id="load" v-if="store.phase !== 'ready'">
      <template v-if="store.phase === 'loading'"><div class="spin"></div><div>{{ store.loadingMsg }}</div></template>
      <template v-else>
        <div class="err">Não foi possível iniciar o Atlas: {{ store.fatal }}</div>
        <div>Confira se o servidor está rodando (<code>uvicorn app:app</code>) e recarregue a página.</div>
      </template>
    </div>
  `,
};

createApp(App).mount('#app');
