import { computed, shallowRef } from '../../../vendor/vue.esm-browser.prod.js';

const STORAGE_KEY = 'atlas.blog.failed-images';

function readFailedUrls() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter(url => typeof url === 'string') : []);
  } catch {
    return new Set();
  }
}

const failedUrls = shallowRef(readFailedUrls());

export function normalizeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const base = globalThis.location?.href || 'https://localhost/';
    const url = new URL(value.trim(), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (globalThis.location?.protocol === 'https:' && url.protocol === 'http:') {
      url.protocol = 'https:';
    }
    return url.href;
  } catch {
    return '';
  }
}

export function useImageHealth() {
  const failed = computed(() => failedUrls.value);

  function isFailed(url) {
    const normalized = normalizeImageUrl(url);
    return Boolean(normalized && failedUrls.value.has(normalized));
  }

  function markFailed(urls) {
    const normalized = (Array.isArray(urls) ? urls : [urls])
      .map(normalizeImageUrl)
      .filter(Boolean);
    const additions = normalized.filter(url => !failedUrls.value.has(url));
    if (!additions.length) return;

    failedUrls.value = new Set([...failedUrls.value, ...additions]);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...failedUrls.value]));
    } catch {
      // The in-memory registry remains available when session storage is disabled.
    }
  }

  return { failedUrls: failed, isFailed, markFailed };
}
