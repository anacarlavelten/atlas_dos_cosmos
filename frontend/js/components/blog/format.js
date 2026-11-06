/* Utilidades de data e texto do blog (pt-BR). */
import { ref } from 'vue';

/* Relógio compartilhado: um único timer atualiza contagens regressivas e
   "há 5 min" em todos os componentes. */
export const now = ref(Date.now());
setInterval(() => { now.value = Date.now(); }, 1000);

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function ago(iso, ref = now.value) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.round((t - ref) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return 'agora';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const hour = iso => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const dateLong = iso => {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const dateTime = iso => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/* Rótulo do dia na linha do tempo: "Hoje", "Ontem" ou "terça-feira, 3 de novembro". */
export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const full = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
  if (dayKey(d) === dayKey(today)) return { title: 'Hoje', sub: full };
  if (dayKey(d) === dayKey(yesterday)) return { title: 'Ontem', sub: full };
  return { title: full.charAt(0).toUpperCase() + full.slice(1), sub: '' };
}

/* Agrupa publicações (já ordenadas da mais nova para a mais antiga) por dia local. */
export function groupByDay(posts) {
  const groups = [];
  for (const p of posts) {
    const key = dayKey(new Date(p.published_at));
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, ...dayLabel(p.published_at), posts: [] }; groups.push(g); }
    g.posts.push(p);
  }
  return groups;
}

/* Contagem regressiva "T− 2d 04:12:09" (ou "T+" depois do horário). */
export function countdown(iso, ref = now.value) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  let s = Math.round((t - ref) / 1000);
  const sign = s >= 0 ? '−' : '+';
  s = Math.abs(s);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return { sign, d, h: pad(h), m: pad(m), s: pad(sec), past: sign === '+' };
}

/* Esconde o quadro da imagem quando ela não carrega (link quebrado na origem). */
export const hideBroken = e => { e.target.closest('[data-img]')?.classList.add('noimg'); };
