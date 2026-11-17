/* Atalho entre o Atlas (páginas de notícias e ferramentas) e o Simulador.
   A troca é feita pelo endereço (#/noticias, #/simulador); main.js observa o hash. */
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
