export default {
  name: 'DownloadsRow',
  template: `
  <section class="downloads-section" aria-labelledby="downloads-title">
    <div class="section-heading"><div><span class="eyebrow">Explore mais</span><h2 id="downloads-title">Downloads / Ferramentas</h2></div><a href="#technology-tools">Ver tudo ↓</a></div>
    <div class="downloads-row">
      <a class="download-tool" href="#/simulador"><span class="tool-icon" aria-hidden="true">◎</span><b>Simulador 3D</b></a>
      <a class="download-tool" href="#birth-sky"><span class="tool-icon" aria-hidden="true">✦</span><b>Céu do nascimento</b></a>
      <a class="download-tool" href="#technology-tools"><span class="tool-icon" aria-hidden="true">⌘</span><b>Tecnologias NASA</b></a>
      <a class="download-tool" href="#all-stories"><span class="tool-icon" aria-hidden="true">▤</span><b>Arquivo de notícias</b></a>
    </div>
  </section>`,
};
