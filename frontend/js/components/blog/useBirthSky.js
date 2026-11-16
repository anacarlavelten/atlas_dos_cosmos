import { computed, onMounted, ref } from '../../../vendor/vue.esm-browser.prod.js';
import { api, once } from '../../api.js';

export const APOD_FIRST_DATE = '1995-06-16';
const STORAGE_KEY = 'atlas.birth-sky.date';
const APOD_CACHE_PREFIX = 'atlas.birth-sky.apod.v2.';
const IMAGES_CACHE_PREFIX = 'atlas.birth-sky.images.';

const todayISO = () => new Date().toISOString().slice(0, 10);
const isISODate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}

function getSaved(key, expected, field) {
  const raw = readStorage(key);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data?.[field] === expected ? data : null;
  } catch {
    return null;
  }
}

function daysFromBirthday(birthDate, imageDate) {
  const image = Date.parse(imageDate || '');
  const birth = Date.parse(birthDate);
  return Number.isNaN(image) ? Number.POSITIVE_INFINITY : Math.abs(image - birth);
}

function closestImages(images, birthDate) {
  return [...new Map((images || []).filter(image => image?.nasa_id)
    .map(image => [image.nasa_id, image])).values()]
    .sort((a, b) => daysFromBirthday(birthDate, a.date_created)
      - daysFromBirthday(birthDate, b.date_created)
      || String(a.nasa_id).localeCompare(String(b.nasa_id)))
    .slice(0, 4);
}

export default function useBirthSky() {
  const date = ref('');
  const result = ref(null);
  const error = ref('');
  const loading = ref(false);
  const shareMessage = ref('');
  const historicalImages = ref([]);
  const historicalError = ref('');
  const today = todayISO();
  const unsupportedDate = computed(() => Boolean(isISODate(date.value) && date.value < APOD_FIRST_DATE));
  const canLoad = computed(() => isISODate(date.value) && date.value <= today);
  const resultLabel = computed(() => result.value && unsupportedDate.value
    ? 'Primeira APOD da história · 16 de junho de 1995'
    : 'NASA · APOD');

  function rememberDate(day) {
    writeStorage(STORAGE_KEY, day);
  }

  async function fetchApod(day, retry = false) {
    if (!retry) {
      const cached = getSaved(APOD_CACHE_PREFIX + day, day, 'date');
      if (cached) return cached;
    }
    const data = retry
      ? await api.apodForDate(day)
      : await once('birth-apod:' + day, () => api.apodForDate(day));
    writeStorage(APOD_CACHE_PREFIX + day, JSON.stringify(data));
    return data;
  }

  async function fetchHistoricalImages(year, retry = false) {
    if (!retry) {
      const cached = getSaved(IMAGES_CACHE_PREFIX + year, year, 'year');
      if (cached) return cached.images || [];
    }
    const data = retry
      ? await api.birthImages(year)
      : await once('birth-images:' + year, () => api.birthImages(year));
    writeStorage(IMAGES_CACHE_PREFIX + year, JSON.stringify(data));
    return data.images || [];
  }

  async function load(day = date.value, retry = false) {
    date.value = day;
    error.value = '';
    historicalError.value = '';
    historicalImages.value = [];
    result.value = null;
    shareMessage.value = '';
    if (!isISODate(day)) {
      error.value = 'Informe uma data válida para consultar as imagens.';
      return;
    }
    if (day > today) {
      error.value = 'Escolha uma data que já aconteceu.';
      return;
    }
    rememberDate(day);
    loading.value = true;
    try {
      if (day < APOD_FIRST_DATE) {
        historicalImages.value = closestImages(await fetchHistoricalImages(day.slice(0, 4), retry), day);
        if (!historicalImages.value.length) {
          result.value = await fetchApod(APOD_FIRST_DATE, retry);
        }
      } else {
        result.value = await fetchApod(day, retry);
      }
    } catch (err) {
      if (unsupportedDate.value) {
        historicalError.value = err.status === 429
          ? 'A cota do serviço foi atingida. Aguarde um pouco ou tente novamente mais tarde.'
          : err.message || 'Não foi possível buscar imagens da NASA para este ano.';
      } else {
        error.value = err.status === 429
          ? 'A cota da NASA foi atingida. Aguarde um pouco ou tente novamente mais tarde.'
          : err.message || 'Não foi possível carregar a imagem astronômica dessa data.';
      }
    } finally {
      loading.value = false;
    }
  }

  async function share() {
    const url = new URL(location.href);
    url.searchParams.set('nascimento', date.value);
    const shareData = { title: 'Céu do meu nascimento · Atlas do Cosmos', url: url.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        shareMessage.value = 'Link compartilhado.';
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.href);
        shareMessage.value = 'Link copiado para compartilhar.';
      } else {
        shareMessage.value = `Copie este link: ${url.href}`;
      }
    } catch (err) {
      if (err.name !== 'AbortError') shareMessage.value = `Copie este link: ${url.href}`;
    }
  }

  onMounted(() => {
    const params = new URLSearchParams(location.search);
    const queryDate = params.get('nascimento');
    const remembered = readStorage(STORAGE_KEY);
    const initial = queryDate !== null ? queryDate : remembered;
    if (initial !== null) {
      if (isISODate(initial) && initial <= today) {
        date.value = initial;
        load(initial);
      } else {
        error.value = isISODate(initial)
          ? 'A data salva não pode estar no futuro. Escolha outra data.'
          : 'A data presente no link é inválida. Escolha uma data no calendário.';
      }
    }
  });

  return {
    date, result, error, loading, shareMessage, historicalImages, historicalError,
    today, unsupportedDate, canLoad, resultLabel, load, share,
  };
}
