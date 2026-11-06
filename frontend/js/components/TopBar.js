import { computed } from 'vue';
import { store, engineRef } from '../store.js';
import { overallStatus } from './SourcesPanel.js';
import ViewSwitch from './ViewSwitch.js';

export default {
  name: 'TopBar',
  components: { ViewSwitch },
  setup() {
    const status = computed(() => overallStatus());
    const goLevel = n => engineRef.current?.goLevel(n, 'tab');
    const toggle = key => {
      const value = !store[key];
      store.sourcesOpen = false; store.listOpen = key === 'listOpen' ? value : store.listOpen;
      store[key] = value;
    };
    return { store, status, goLevel, toggle };
  },
  template: `
  <div id="top">
    <div class="panel brand">Atlas do <b>Cosmos</b></div>
    <ViewSwitch class="panel" />
    <div class="panel" id="tabs" role="tablist">
      <button v-for="l in store.levels" :key="l.level" role="tab" :aria-selected="store.level === l.level"
              :class="{ on: store.level === l.level }" @click="goLevel(l.level)">{{ l.name }}</button>
    </div>
    <div class="sp"></div>
    <button class="ibtn" @click="toggle('sourcesOpen')" :aria-expanded="store.sourcesOpen" title="De onde vêm os dados">
      <span class="dot" :class="status"></span><span class="hide-m">Dados da NASA</span>
    </button>
    <button class="ibtn" @click="store.apodOpen = true" title="Foto astronômica do dia (NASA APOD)">
      <span>Foto do dia</span>
    </button>
    <button class="ibtn only-m" @click="toggle('listOpen')">Lista</button>
    <button class="ibtn" @click="store.introOpen = true" aria-label="Ajuda">?</button>
  </div>`,
};
