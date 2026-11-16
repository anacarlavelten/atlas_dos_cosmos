import { computed, ref } from 'vue';
import ViewSwitch from '../ViewSwitch.js';
import { now } from './format.js';
import BlogHero from './BlogHero.js';
import BlogTimeline from './BlogTimeline.js';
import MediaStrip from './MediaStrip.js';
import { distributeFeed } from './useFeedDistribution.js';

export default {
  name: 'BlogPage',
  components: { ViewSwitch, BlogHero, BlogTimeline, MediaStrip },
  setup() {
    const distribution = ref(distributeFeed([]));
    const clock = computed(() => new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(now.value));
    const updateDistribution = value => { distribution.value = value; };
    return { distribution, clock, updateDistribution };
  },
  template: `
  <div id="blog">
    <header class="bhead" id="top">
      <div class="bhead-top">
        <div class="bhead-main">
          <a class="brand" href="#top" aria-label="Atlas do Cosmos, início">Atlas do <b>Cosmos</b></a>
          <div class="header-clock" aria-label="Localização e hora atual">
            <span class="eyebrow">OBSERVATÓRIO · TERRA</span>
            <time>{{ clock }}</time>
          </div>
          <div class="header-actions">
            <a href="#birth-sky" aria-label="Abrir Céu do seu nascimento"><span aria-hidden="true">✦</span></a>
            <a href="#all-stories" aria-label="Buscar em todas as notícias"><span aria-hidden="true">⌕</span></a>
            <ViewSwitch class="panel" />
          </div>
        </div>
        <nav class="bnav" aria-label="Navegação principal">
          <a class="active" href="#latest-stories">ÚLTIMAS</a>
          <a href="#launches-title">LANÇAMENTOS</a>
          <a href="#space-weather">CLIMA ESPACIAL</a>
          <a href="#near-asteroids">ASTEROIDES</a>
          <a href="#technology-tools">TECNOLOGIAS</a>
          <a href="#all-stories">TODAS AS NOTÍCIAS</a>
        </nav>
      </div>
    </header>
    <main class="bwrap editorial">
      <MediaStrip :posts="distribution.media" />
      <BlogHero
        :lead="distribution.heroLead"
        :side-stories="distribution.heroSides"
        :related-stories="distribution.related"
      />
      <BlogTimeline @distribution-update="updateDistribution" />
    </main>
    <footer class="bfoot">
      <div class="bwrap">
        <nav class="footer-nav" aria-label="Links de rodapé">
          <a href="#top">ATLAS DO COSMOS</a><a href="#all-stories">NOTÍCIAS</a><a href="#launches-title">MISSÕES</a><a href="#technology-tools">TECNOLOGIA</a><a href="#/simulador">SIMULADOR</a>
        </nav>
        <b>Fontes de dados</b>
        <p class="muted">
          Publicações: <a href="https://spaceflightnewsapi.net" target="_blank" rel="noopener">Spaceflight News API</a> ·
          Lançamentos: <a href="https://thespacedevs.com/llapi" target="_blank" rel="noopener">Launch Library 2 (The Space Devs)</a> ·
          Imagem do dia: <a href="https://apod.nasa.gov" target="_blank" rel="noopener">NASA APOD</a> ·
          Clima espacial: <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">NASA DONKI</a> ·
          Asteroides: <a href="https://api.nasa.gov" target="_blank" rel="noopener">NASA NeoWs</a> ·
          Tecnologias: <a href="https://technology.nasa.gov" target="_blank" rel="noopener">NASA Technology Transfer</a>.
          As respostas ficam em cache no servidor do Atlas; os textos das publicações são os originais de cada site.
        </p>
      </div>
    </footer>
  </div>`,
};
