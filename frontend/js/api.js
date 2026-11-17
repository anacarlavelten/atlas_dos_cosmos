/* Cliente da API do backend. Todas as chamadas à NASA passam pelo backend:
   o navegador nunca vê a chave da API. */
import { API_BASE } from './config.js';

async function request(method, path, { body, headers } = {}) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor do Atlas.');
  }
  let data = null;
  if (response.status !== 204) {
    try { data = await response.json(); } catch { data = null; }
  }
  if (!response.ok) {
    const err = new Error(typeof data?.detail === 'string' ? data.detail : `Erro HTTP ${response.status}`);
    err.status = response.status;
    // Erros de validação (HTTP 422) chegam campo a campo: { campo: "mensagem" }.
    err.fields = Object.fromEntries((data?.errors || []).map(e => [e.field, e.message]));
    throw err;
  }
  return data;
}

const get = path => request('GET', path);

export const api = {
  health: () => get('/api/health'),
  levels: () => get('/api/catalog/levels'),
  bodies: () => get('/api/catalog/bodies'),
  orbits: () => get('/api/orbits'),
  neoWeek: () => get('/api/neo/week'),
  exoHosts: () => get('/api/exoplanets/hosts'),
  apod: () => get('/api/media/apod'),
  apodForDate: date => get(`/api/media/apod?date=${encodeURIComponent(date)}`),
  birthImages: year => get(`/api/media/birth-images/${encodeURIComponent(year)}`),
  epic: () => get('/api/media/epic'),
  images: slug => get(`/api/media/images/${encodeURIComponent(slug)}?limit=4`),
  // Blog
  blogTopics: () => get('/api/blog/topics'),
  blogFeed: ({ kind, topic, q, offset = 0, limit = 20 }) => {
    const params = new URLSearchParams({ kind, topic, offset, limit });
    if (q) params.set('q', q);
    return get(`/api/blog/feed?${params}`);
  },
  blogLaunches: () => get('/api/blog/launches?limit=6'),
  blogTech: area => get(`/api/blog/technologies/${encodeURIComponent(area)}?limit=4`),
  // Diário de observação (formulário enviado ao servidor)
  observationOptions: () => get('/api/observations/options'),
  observations: ({ body, offset = 0, limit = 6 } = {}) => {
    const params = new URLSearchParams({ offset, limit });
    if (body) params.set('body', body);
    return get(`/api/observations?${params}`);
  },
  createObservation: data => request('POST', '/api/observations', { body: data }),
  deleteObservation: (id, token) => request('DELETE', `/api/observations/${id}`, { headers: { 'X-Delete-Token': token } }),
};

/* Memoriza pedidos dos cards para não repetir a mesma consulta ao reabrir um astro. */
const memo = new Map();
export function once(key, fn) {
  if (!memo.has(key)) memo.set(key, fn().catch(err => { memo.delete(key); throw err; }));
  return memo.get(key);
}
