import { computed } from 'vue';
import { dateTime } from './format.js';
import { useCountdown } from './useCountdown.js';

export default {
  name: 'LaunchCountdown',
  props: {
    launch: { type: Object, required: true },
    variant: { type: String, default: 'compact' },
  },
  setup(props) {
    const countdown = useCountdown(() => props.launch.net);
    const dateLabel = computed(() => props.launch.net ? dateTime(props.launch.net) : 'Data a confirmar');
    const details = computed(() => [
      ['Situação', props.launch.status || props.launch.status_abbrev],
      ['Operador', props.launch.provider],
      ['Foguete', props.launch.rocket],
      ['Órbita', props.launch.orbit],
      ['Local', props.launch.location || props.launch.pad],
    ].filter(([, value]) => value));
    return { ...countdown, dateLabel, details };
  },
  template: `
  <span v-if="variant === 'summary' && status !== 'passed'" class="launch-countdown-summary" :aria-label="ariaLabel">
    {{ compact }}
  </span>
  <span v-else-if="variant === 'compact' && status !== 'passed'" class="launch-countdown" :aria-label="ariaLabel">
    {{ compact }}
  </span>
  <article v-else-if="variant !== 'summary' && status !== 'passed'" class="launch-countdown-card" :class="{ 'hero-launch-countdown': variant !== 'compact' }" :aria-label="'Próximo lançamento: ' + launch.name">
    <div class="launch-countdown-heading">
      <div><span class="eyebrow">Próximo lançamento</span><h2>{{ launch.name }}</h2></div>
      <a :href="launch.page_url" target="_blank" rel="noopener" class="launch-details-link">Detalhes ↗</a>
    </div>
    <p v-if="status === 'tbd'" class="launch-countdown-state" role="status">Data a confirmar</p>
    <p v-else-if="status === 'launching'" class="launch-countdown-state" role="status">Lançamento em andamento</p>
    <div v-else class="countdown-units" role="group" :aria-label="ariaLabel">
      <span class="countdown-unit"><b>{{ parts.days }}</b><small>{{ parts.days === 1 ? 'dia' : 'dias' }}</small></span>
      <span class="countdown-unit"><b>{{ String(parts.hours).padStart(2, '0') }}</b><small>horas</small></span>
      <span class="countdown-unit"><b>{{ String(parts.minutes).padStart(2, '0') }}</b><small>minutos</small></span>
      <span class="countdown-unit"><b aria-live="off">{{ String(parts.seconds).padStart(2, '0') }}</b><small>segundos</small></span>
    </div>
    <dl class="launch-countdown-meta">
      <div><dt>Data e hora</dt><dd>{{ dateLabel }}</dd></div>
      <div v-for="detail in details" :key="detail[0]"><dt>{{ detail[0] }}</dt><dd>{{ detail[1] }}</dd></div>
    </dl>
  </article>`,
};
