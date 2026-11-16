import { computed, onBeforeUnmount, onMounted, ref, toValue } from '../../../vendor/vue.esm-browser.prod.js';

const T_MINUS_ZERO_WINDOW_MS = 1000;

function targetTimestamp(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function useCountdown(targetDate) {
  const now = ref(Date.now());
  let interval = null;
  const target = computed(() => targetTimestamp(toValue(targetDate)));
  const remaining = computed(() => target.value === null ? null : target.value - now.value);
  const status = computed(() => {
    if (remaining.value === null) return 'tbd';
    if (remaining.value < 0) return 'passed';
    if (remaining.value <= T_MINUS_ZERO_WINDOW_MS) return 'launching';
    return 'countdown';
  });
  const parts = computed(() => {
    if (remaining.value === null || remaining.value < 0) return null;
    const seconds = Math.floor(remaining.value / 1000);
    return {
      days: Math.floor(seconds / 86400),
      hours: Math.floor((seconds % 86400) / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60,
    };
  });
  const ariaLabel = computed(() => {
    if (status.value === 'tbd') return 'Data do lançamento a confirmar';
    if (status.value === 'passed') return 'O lançamento já ocorreu';
    if (status.value === 'launching') return 'Lançamento em andamento';
    const value = parts.value;
    return `Faltam ${value.days} ${value.days === 1 ? 'dia' : 'dias'}, ${value.hours} ${value.hours === 1 ? 'hora' : 'horas'}, ${value.minutes} ${value.minutes === 1 ? 'minuto' : 'minutos'} e ${value.seconds} ${value.seconds === 1 ? 'segundo' : 'segundos'}`;
  });
  const compact = computed(() => {
    if (status.value === 'tbd') return 'Data a confirmar';
    if (status.value === 'passed') return '';
    if (status.value === 'launching') return 'T-0';
    const value = parts.value;
    return value.days
      ? `em ${value.days} d ${value.hours} h`
      : `em ${value.hours} h ${String(value.minutes).padStart(2, '0')} min`;
  });

  onMounted(() => {
    interval = setInterval(() => { now.value = Date.now(); }, 1000);
  });
  onBeforeUnmount(() => {
    if (interval !== null) clearInterval(interval);
  });

  return { now, target, remaining, status, parts, ariaLabel, compact };
}
