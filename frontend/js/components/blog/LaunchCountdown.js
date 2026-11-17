import { useCountdown } from './useCountdown.js';

export default {
  name: 'LaunchCountdown',
  props: {
    launch: { type: Object, required: true },
    variant: { type: String, default: 'compact' },
  },
  setup(props) {
    const countdown = useCountdown(() => props.launch.net);
    return { ...countdown };
  },
  template: `
  <span v-if="variant === 'summary' && status !== 'passed'" class="launch-countdown-summary" :aria-label="ariaLabel">
    {{ compact }}
  </span>
  <span v-else-if="variant === 'compact' && status !== 'passed'" class="launch-countdown" :aria-label="ariaLabel">
    {{ compact }}
  </span>`,
};
