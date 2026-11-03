/* Card com as informações do astro selecionado. */
import { computed } from 'vue';
import { store, engineRef, cardFor, colorOf } from '../store.js';
import { ImageStrip, FlaresWidget, EpicWidget, NeosWidget, ExoWidget } from './LiveWidgets.js';

export default {
  name: 'BodyCard',
  components: { ImageStrip, FlaresWidget, EpicWidget, NeosWidget, ExoWidget },
  setup() {
    const card = computed(() => cardFor(store.selectedId));
    const color = computed(() => (card.value ? colorOf(card.value.category) : '#fff'));
    const has = key => card.value?.live?.includes(key);
    const close = () => engineRef.current?.select(null);
    const act = () => {
      const a = card.value?.action;
      if (a) engineRef.current?.goLevel(a.level, a.level > store.level ? 'up' : 'down');
    };
    return { card, color, has, close, act };
  },
  template: `
  <aside class="panel" id="card" :class="{ on: !!card }" aria-live="polite">
    <template v-if="card">
      <button class="x" aria-label="Fechar" @click="close">×</button>
      <span class="chip" :style="{ '--c': color }"><i></i>{{ card.kind }}</span>
      <h2>{{ card.name }}</h2>
      <p>{{ card.summary }}</p>
      <dl v-if="card.facts && card.facts.length">
        <template v-for="f in card.facts" :key="f.label"><dt>{{ f.label }}</dt><dd>{{ f.value }}</dd></template>
      </dl>
      <div class="cur" v-if="card.curiosity"><b>Você sabia?</b>{{ card.curiosity }}</div>
      <FlaresWidget v-if="has('flares')" />
      <EpicWidget v-if="has('epic')" />
      <NeosWidget v-if="has('neos')" />
      <ExoWidget v-if="has('exoplanets')" />
      <ImageStrip v-if="card.slug" :slug="card.slug" :key="card.slug" />
      <p class="src" v-if="card.source">{{ card.source }}</p>
      <a class="linkbtn" v-if="card.link" :href="card.link.url" target="_blank" rel="noopener">{{ card.link.label }} ↗</a>
      <button class="act" v-if="card.action" @click="act">{{ card.action.label }}</button>
    </template>
  </aside>`,
};
