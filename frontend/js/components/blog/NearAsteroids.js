import { computed, onMounted } from 'vue';
import { api } from '../../api.js';
import { fmt } from '../../engine/util.js';
import { loadSource, sourceState } from './useSource.js';

export default {
  name: 'NearAsteroids',
  setup() {
    const neos = sourceState();
    const nearest = computed(() => neos.data?.objects || []);
    const retry = () => loadSource(neos, 'neoWeek', api.neoWeek);
    const neoDate = object => (object.approach_epoch_ms
      ? new Date(object.approach_epoch_ms).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      : object.approach_date);
    onMounted(retry);
    return { neos, nearest, neoDate, fmt, retry };
  },
  template: `
  <section id="near-asteroids" class="signal-card page-card" aria-labelledby="near-asteroids-title">
    <div class="module-heading"><span class="eyebrow">NASA NEOWS · ESTA SEMANA</span><h2 id="near-asteroids-title">Asteroides próximos</h2></div>
    <div v-if="neos.loading" class="signal-skeleton" aria-label="Carregando asteroides próximos"></div>
    <div v-else-if="neos.error" class="module-error" role="alert">{{ neos.error }} <button class="text-button" type="button" @click="retry">Tentar de novo</button></div>
    <template v-else-if="neos.data">
      <p class="signal-stat"><b>{{ neos.data.total_in_week }}</b> objetos próximos nesta semana</p>
      <ul class="near-list">
        <li v-for="object in nearest" :key="object.id">
          <a v-if="object.jpl_url" :href="object.jpl_url" target="_blank" rel="noopener">{{ object.name }}</a><span v-else>{{ object.name }}</span>
          <small>{{ neoDate(object) }} · {{ fmt(object.miss_distance_lunar, 1) }}× Terra–Lua<template v-if="object.hazardous"> · potencialmente perigoso</template></small>
        </li>
      </ul>
      <a class="signal-link" href="#/simulador">Explorar órbitas no simulador ↗</a>
      <p class="signal-source">Fonte: NASA NeoWs<span v-if="neos.data.stale"> · dados em cache</span></p>
    </template>
  </section>`,
};
