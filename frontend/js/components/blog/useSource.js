/* Estado de carregamento de uma fonte de dados das páginas do Atlas. */
import { reactive } from 'vue';
import { once } from '../../api.js';

export function sourceState() {
  return reactive({ data: null, error: '', loading: true });
}

export async function loadSource(state, key, fetcher) {
  state.loading = true;
  state.error = '';
  try {
    state.data = await once(key, fetcher);
  } catch (error) {
    state.error = error.message || 'Não foi possível carregar esta fonte.';
  } finally {
    state.loading = false;
  }
}
