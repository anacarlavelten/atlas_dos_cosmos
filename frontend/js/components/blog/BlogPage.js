/* Página do blog (aba principal do Atlas). Nenhum conteúdo fica fixo no código:
   tudo vem do backend, que consulta e guarda em cache as APIs abertas. */
import ViewSwitch from '../ViewSwitch.js';
import BlogHero from './BlogHero.js';
import BlogTimeline from './BlogTimeline.js';
import BlogSidebar from './BlogSidebar.js';

export default {
  name: 'BlogPage',
  components: { ViewSwitch, BlogHero, BlogTimeline, BlogSidebar },
  template: `
  <div id="blog">
    <header class="bhead">
      <div class="bhead-in">
        <a class="panel brand" href="#/blog">Atlas do <b>Cosmos</b></a>
        <ViewSwitch class="panel" />
        <div class="sp"></div>
        <span class="tagline hide-m">Notícias do espaço e da tecnologia espacial</span>
      </div>
    </header>
    <main class="bwrap">
      <BlogHero />
      <div class="bgrid">
        <BlogTimeline />
        <BlogSidebar />
      </div>
    </main>
    <footer class="bfoot">
      <div class="bwrap">
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
