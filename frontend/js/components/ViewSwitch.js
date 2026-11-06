/* Abas principais do Atlas: Blog (página inicial) e Simulador.
   A troca é feita pelo endereço (#/blog, #/simulador); main.js observa o hash. */
import { store } from '../store.js';

export function goView(view) {
  const hash = view === 'sim' ? '#/simulador' : '#/blog';
  if (location.hash !== hash) location.hash = hash;
}

export default {
  name: 'ViewSwitch',
  setup() { return { store, goView }; },
  template: `
  <nav class="views" aria-label="Seções do Atlas">
    <a href="#/blog" :class="{ on: store.view === 'blog' }" :aria-current="store.view === 'blog' ? 'page' : null">Blog</a>
    <a href="#/simulador" :class="{ on: store.view === 'sim' }" :aria-current="store.view === 'sim' ? 'page' : null">Simulador</a>
  </nav>`,
};
