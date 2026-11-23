import { store } from '../store.js';

export default {
  name: 'ViewSwitch',
  setup() { return { store }; },
  template: `
  <nav class="views" aria-label="Seções do Atlas">
    <a href="#/noticias" :class="{ on: store.view === 'blog' }" :aria-current="store.view === 'blog' ? 'page' : null">Atlas</a>
    <a href="#/simulador" :class="{ on: store.view === 'sim' }" :aria-current="store.view === 'sim' ? 'page' : null">Simulador</a>
  </nav>`,
};
