/* Lógica do formulário do Diário de observação.

   A validação de verdade acontece no servidor (Pydantic): o formulário envia os
   dados e, se o servidor recusar (HTTP 422), mostra a mensagem de cada campo ao
   lado dele. Aqui só fazemos o que é conveniência para quem preenche: limpar
   espaços, converter a nota para número e lembrar o código de exclusão. */
import { computed, reactive, ref } from '../../../vendor/vue.esm-browser.prod.js';
import { api, once } from '../../api.js';

export const PAGE_SIZE = 6;
const TOKENS_KEY = 'atlas.observations.tokens';
const PROFILE_KEY = 'atlas.observations.profile';

export const emptyForm = () => ({
  body_slug: '',
  observer_name: '',
  observed_at: '',
  location: '',
  instrument: '',
  sky_quality: '',
  notes: '',
});

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* armazenamento é opcional */ }
}

/* Converte o estado do formulário no JSON que a API espera. */
export function toPayload(form) {
  const text = value => String(value ?? '').trim();
  const quality = text(form.sky_quality);
  return {
    body_slug: text(form.body_slug),
    observer_name: text(form.observer_name),
    observed_at: text(form.observed_at),
    location: text(form.location),
    instrument: text(form.instrument),
    // Vazio continua vazio (o servidor responde "Campo obrigatório.").
    sky_quality: quality === '' ? null : Number.isNaN(Number(quality)) ? quality : Number(quality),
    notes: text(form.notes),
  };
}

/* Remove do JSON os campos vazios obrigatórios, para o servidor dizer quais faltam. */
function withoutEmpty(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => key === 'notes' || (value !== '' && value !== null)));
}

export default function useObservationForm() {
  const form = reactive(emptyForm());
  const errors = ref({});
  const formError = ref('');
  const success = ref('');
  const submitting = ref(false);

  const options = ref({ instruments: [], sky_quality: [], min_date: '1900-01-01', max_date: '' });
  const bodies = ref([]);
  const setupError = ref('');

  const list = reactive({ items: [], total: 0, filter: '', loading: false, error: '' });
  const tokens = ref(readJson(TOKENS_KEY, {}));

  /* Astros agrupados como na lista do simulador (Planetas, Luas...). */
  const bodyGroups = computed(() => {
    const groups = new Map();
    for (const body of bodies.value) {
      if (!groups.has(body.group)) groups.set(body.group, []);
      groups.get(body.group).push(body);
    }
    return [...groups].map(([label, items]) => ({ label, items }));
  });
  const hasMore = computed(() => list.items.length < list.total);
  const canDelete = item => Boolean(tokens.value[item.id]);

  async function loadSetup() {
    setupError.value = '';
    try {
      const [opts, catalog] = await Promise.all([
        once('observationOptions', api.observationOptions),
        once('bodies', api.bodies),
      ]);
      options.value = opts;
      bodies.value = catalog;
      const profile = readJson(PROFILE_KEY, null);
      if (profile && !form.observer_name) {
        form.observer_name = profile.observer_name || '';
        form.location = profile.location || '';
      }
    } catch (err) {
      setupError.value = err.message;
    }
  }

  async function loadList(reset = true) {
    list.loading = true;
    list.error = '';
    try {
      const data = await api.observations({ body: list.filter, offset: reset ? 0 : list.items.length, limit: PAGE_SIZE });
      list.items = reset ? data.items : [...list.items, ...data.items];
      list.total = data.total;
    } catch (err) {
      list.error = err.message;
    } finally {
      list.loading = false;
    }
  }

  async function submit() {
    errors.value = {};
    formError.value = '';
    success.value = '';
    submitting.value = true;
    try {
      const created = await api.createObservation(withoutEmpty(toPayload(form)));
      const { delete_token: token, ...item } = created;
      tokens.value = { ...tokens.value, [item.id]: token };
      writeJson(TOKENS_KEY, tokens.value);
      writeJson(PROFILE_KEY, { observer_name: item.observer_name, location: item.location });
      success.value = `Observação de ${item.body.name} registrada. Obrigado!`;
      Object.assign(form, emptyForm(), { observer_name: item.observer_name, location: item.location });
      if (!list.filter || list.filter === item.body.slug) {
        list.items = [item, ...list.items];
        list.total += 1;
      }
      return item;
    } catch (err) {
      if (err.status === 422 && Object.keys(err.fields || {}).length) {
        errors.value = err.fields;
        formError.value = err.message;
      } else {
        formError.value = err.message || 'Não foi possível salvar a observação.';
      }
      return null;
    } finally {
      submitting.value = false;
    }
  }

  async function remove(item) {
    const token = tokens.value[item.id];
    if (!token) return false;
    try {
      await api.deleteObservation(item.id, token);
    } catch (err) {
      if (err.status !== 404) { list.error = err.message; return false; }
    }
    const { [item.id]: _removed, ...rest } = tokens.value;
    tokens.value = rest;
    writeJson(TOKENS_KEY, rest);
    list.items = list.items.filter(other => other.id !== item.id);
    list.total = Math.max(0, list.total - 1);
    return true;
  }

  function setFilter(slug) {
    list.filter = slug;
    loadList(true);
  }

  const clearError = field => {
    if (errors.value[field]) {
      const { [field]: _cleared, ...rest } = errors.value;
      errors.value = rest;
    }
  };

  return {
    form, errors, formError, success, submitting, options, bodies, bodyGroups, setupError,
    list, hasMore, canDelete, loadSetup, loadList, submit, remove, setFilter, clearError,
  };
}
