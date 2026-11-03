/* Barra inferior: tempo, escala dos astros e camadas visíveis. */
import { store, engineRef } from '../store.js';

export function syncControls() {
  const e = engineRef.current;
  if (!e) return;
  store.speedValue = e.speedSliderValue();
  store.speedLabel = e.speedLabel();
  store.scaleValue = e.scaleSliderValue();
  store.scaleLabel = e.scaleLabel();
}

export default {
  name: 'ControlBar',
  setup() {
    const e = () => engineRef.current;
    const onSpeed = ev => { store.speedValue = +ev.target.value; store.speedLabel = e()?.setSpeedSlider(+ev.target.value) ?? ''; };
    const onScale = ev => { store.scaleValue = +ev.target.value; store.scaleLabel = e()?.setScaleSlider(+ev.target.value) ?? ''; };
    const toggle = (key, method) => ev => { store[key] = ev.target.checked; e()?.[method](ev.target.checked); };
    return {
      store, onSpeed, onScale,
      play: () => e()?.togglePlay(),
      reverse: () => e()?.reverse(),
      today: () => e()?.today(),
      onOrbits: toggle('showOrbits', 'setShowOrbits'),
      onNames: toggle('showNames', 'setShowNames'),
      onNeos: toggle('showNeos', 'setShowNeos'),
      onExo: toggle('showExo', 'setShowExo'),
    };
  },
  template: `
  <div class="panel" id="bar">
    <button class="pb" @click="play" :aria-label="store.playing ? 'Pausar' : 'Continuar'">{{ store.playing ? '❚❚' : '▶' }}</button>
    <label v-if="store.level !== 3">Tempo
      <input type="range" min="0" max="1000" :value="store.speedValue" @input="onSpeed" aria-label="Velocidade do tempo">
      <span class="v">{{ store.speedLabel }}</span></label>
    <template v-if="store.level === 1">
      <button class="sm" @click="reverse">{{ store.dir > 0 ? 'Inverter' : 'Voltar ao normal' }}</button>
      <button class="sm" @click="today">Hoje</button>
      <span class="sep hide-m"></span>
      <label class="hide-m">Tamanho dos astros
        <input type="range" min="0" max="100" :value="store.scaleValue" @input="onScale" aria-label="Tamanho dos astros">
        <span class="v">{{ store.scaleLabel }}</span></label>
      <label><input type="checkbox" :checked="store.showOrbits" @change="onOrbits">Órbitas</label>
      <label v-if="store.neos"><input type="checkbox" :checked="store.showNeos" @change="onNeos">Asteroides</label>
    </template>
    <label v-if="store.level === 2 && store.exo"><input type="checkbox" :checked="store.showExo" @change="onExo">Exoplanetas</label>
    <label><input type="checkbox" :checked="store.showNames" @change="onNames">Nomes</label>
  </div>`,
};
