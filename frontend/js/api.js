/* Cliente da API do backend. Todas as chamadas à NASA passam pelo backend:
   o navegador nunca vê a chave da API. */
import { API_BASE } from './config.js';

async function get(path) {
  let response;
  try {
    response = await fetch(API_BASE + path, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Não foi possível conectar ao servidor do Atlas.');
  }
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const err = new Error(body?.detail || `Erro HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return body;
}

export const api = {
  health: () => get('/api/health'),
  levels: () => get('/api/catalog/levels'),
  bodies: () => get('/api/catalog/bodies'),
  orbits: () => get('/api/orbits'),
  neoWeek: () => get('/api/neo/week'),
  exoHosts: () => get('/api/exoplanets/hosts'),
  apod: () => get('/api/media/apod'),
  epic: () => get('/api/media/epic'),
  images: slug => get(`/api/media/images/${encodeURIComponent(slug)}?limit=4`),
  flares: () => get('/api/space-weather/flares?days=30'),
  // Blog
  blogTopics: () => get('/api/blog/topics'),
  blogFeed: ({ kind, topic, q, offset = 0, limit = 20 }) => {
    const params = new URLSearchParams({ kind, topic, offset, limit });
    if (q) params.set('q', q);
    return get(`/api/blog/feed?${params}`);
  },
  blogLaunches: () => get('/api/blog/launches?limit=6'),
  blogTech: area => get(`/api/blog/technologies/${encodeURIComponent(area)}?limit=4`),
};

/* Memoriza pedidos dos cards para não repetir a mesma consulta ao reabrir um astro. */
const memo = new Map();
export function once(key, fn) {
  if (!memo.has(key)) memo.set(key, fn().catch(err => { memo.delete(key); throw err; }));
  return memo.get(key);
}
