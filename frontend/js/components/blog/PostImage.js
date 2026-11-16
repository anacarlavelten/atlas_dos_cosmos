import { normalizeImageUrl, useImageHealth } from './useImageHealth.js';

export default {
  name: 'PostImage',
  inheritAttrs: false,
  props: {
    src: { type: String, default: '' },
    fallbackSrc: { type: String, default: '' },
    alt: { type: String, default: '' },
    source: { type: String, default: '' },
    loading: { type: String, default: 'lazy' },
    fetchpriority: { type: String, default: 'auto' },
  },
  data() {
    return { candidates: [], currentIndex: 0, loaded: false, failed: false };
  },
  computed: {
    currentSrc() { return this.candidates[this.currentIndex] || ''; },
    forwardedAttrs() {
      return Object.fromEntries(Object.entries(this.$attrs).filter(([key]) => key !== 'class'));
    },
    componentClasses() {
      return [
        'post-image',
        this.$attrs.class,
        { 'is-loading': !this.loaded && !this.failed, 'is-failed': this.failed },
      ];
    },
  },
  watch: {
    src() { this.resetImage(); },
    fallbackSrc() { this.resetImage(); },
  },
  created() {
    this.resetImage();
  },
  methods: {
    resetImage() {
      const imageHealth = useImageHealth();
      const candidates = [this.src, this.fallbackSrc]
        .map(normalizeImageUrl)
        .filter((url, index, list) => url && list.indexOf(url) === index && !imageHealth.isFailed(url));
      this.candidates = candidates;
      this.currentIndex = 0;
      this.loaded = false;
      this.failed = candidates.length === 0;
    },
    advanceOrFail() {
      if (this.currentIndex + 1 < this.candidates.length) {
        this.currentIndex += 1;
        this.loaded = false;
        return;
      }
      this.failed = true;
      this.loaded = false;
      useImageHealth().markFailed(this.candidates);
    },
    handleLoad(event) {
      const { naturalWidth, naturalHeight } = event.target;
      if (naturalWidth < 40 || naturalHeight < 40) {
        this.advanceOrFail();
        return;
      }
      this.loaded = true;
    },
    handleError() {
      this.advanceOrFail();
    },
  },
  template: `
    <span v-bind="forwardedAttrs" :class="componentClasses" :aria-busy="!loaded && !failed">
      <img
        v-if="currentSrc && !failed"
        class="post-image__img"
        :src="currentSrc"
        :alt="alt"
        :loading="loading"
        :fetchpriority="fetchpriority"
        decoding="async"
        referrerpolicy="no-referrer"
        width="640"
        height="360"
        @load="handleLoad"
        @error="handleError"
      >
      <span v-if="failed" class="post-image__fallback">
        <svg class="post-image__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <circle cx="23" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
          <ellipse cx="23" cy="24" rx="21" ry="7" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-24 23 24)"></ellipse>
          <circle cx="18" cy="19" r="2" fill="currentColor"></circle>
        </svg>
        <small>{{ source || 'Imagem indisponível' }}</small>
      </span>
    </span>`,
};
