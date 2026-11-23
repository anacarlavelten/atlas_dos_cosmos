import { onMounted } from 'vue';
import { dateLong } from './format.js';
import useObservationForm from './useObservationForm.js';

export default {
  name: 'ObservationDiary',
  setup() {
    const diary = useObservationForm();
    onMounted(() => { diary.loadSetup(); diary.loadList(true); });
    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    return { ...diary, dateLong, stars };
  },
  template: `
  <section id="observation-diary" class="observation-diary atlas-bulma" data-bulma-theme="dark" aria-labelledby="diary-title">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Ciência cidadã</span>
        <h2 id="diary-title">Diário de observação</h2>
        <p class="diary-intro">Viu um planeta, a Lua ou uma galáxia? Registre aqui. Os dados ficam salvos no banco do Atlas e aparecem para todos os visitantes.</p>
      </div>
    </div>

    <div class="bulma-columns bulma-is-variable bulma-is-5">
      <div class="bulma-column bulma-is-5-desktop">
        <form class="diary-form" novalidate @submit.prevent="submit" aria-describedby="diary-form-help">
          <p id="diary-form-help" class="diary-help-text">Campos com * são obrigatórios. A validação é feita pelo servidor.</p>

          <div v-if="setupError" class="bulma-notification bulma-is-danger bulma-is-light" role="alert">
            Não foi possível carregar o formulário: {{ setupError }}
            <button class="bulma-button bulma-is-small bulma-is-danger" type="button" @click="loadSetup">Tentar de novo</button>
          </div>

          <div class="bulma-field">
            <label class="bulma-label" for="obs-body">Astro observado *</label>
            <div class="bulma-control">
              <div class="bulma-select bulma-is-fullwidth" :class="{ 'bulma-is-danger': errors.body_slug }">
                <select id="obs-body" v-model="form.body_slug" :aria-invalid="!!errors.body_slug" aria-describedby="obs-body-error" @change="clearError('body_slug')">
                  <option value="">Escolha um astro…</option>
                  <optgroup v-for="group in bodyGroups" :key="group.label" :label="group.label">
                    <option v-for="body in group.items" :key="body.slug" :value="body.slug">{{ body.name }}</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <p v-if="errors.body_slug" id="obs-body-error" class="bulma-help bulma-is-danger">{{ errors.body_slug }}</p>
          </div>

          <div class="bulma-columns bulma-is-mobile bulma-is-variable bulma-is-2">
            <div class="bulma-column">
              <div class="bulma-field">
                <label class="bulma-label" for="obs-date">Data *</label>
                <div class="bulma-control">
                  <input id="obs-date" class="bulma-input" :class="{ 'bulma-is-danger': errors.observed_at }" type="date" v-model="form.observed_at" :min="options.min_date" :max="options.max_date" :aria-invalid="!!errors.observed_at" aria-describedby="obs-date-error" @input="clearError('observed_at')">
                </div>
                <p v-if="errors.observed_at" id="obs-date-error" class="bulma-help bulma-is-danger">{{ errors.observed_at }}</p>
              </div>
            </div>
            <div class="bulma-column">
              <div class="bulma-field">
                <label class="bulma-label" for="obs-instrument">Instrumento *</label>
                <div class="bulma-control">
                  <div class="bulma-select bulma-is-fullwidth" :class="{ 'bulma-is-danger': errors.instrument }">
                    <select id="obs-instrument" v-model="form.instrument" :aria-invalid="!!errors.instrument" aria-describedby="obs-instrument-error" @change="clearError('instrument')">
                      <option value="">Escolha…</option>
                      <option v-for="item in options.instruments" :key="item.key" :value="item.key">{{ item.label }}</option>
                    </select>
                  </div>
                </div>
                <p v-if="errors.instrument" id="obs-instrument-error" class="bulma-help bulma-is-danger">{{ errors.instrument }}</p>
              </div>
            </div>
          </div>

          <div class="bulma-field">
            <label class="bulma-label" for="obs-quality">Qualidade do céu *</label>
            <div class="bulma-control">
              <div class="bulma-select bulma-is-fullwidth" :class="{ 'bulma-is-danger': errors.sky_quality }">
                <select id="obs-quality" v-model="form.sky_quality" :aria-invalid="!!errors.sky_quality" aria-describedby="obs-quality-error" @change="clearError('sky_quality')">
                  <option value="">Como estava o céu?</option>
                  <option v-for="item in options.sky_quality" :key="item.key" :value="item.key">{{ item.label }}</option>
                </select>
              </div>
            </div>
            <p v-if="errors.sky_quality" id="obs-quality-error" class="bulma-help bulma-is-danger">{{ errors.sky_quality }}</p>
          </div>

          <div class="bulma-columns bulma-is-variable bulma-is-2">
            <div class="bulma-column">
              <div class="bulma-field">
                <label class="bulma-label" for="obs-name">Seu nome *</label>
                <div class="bulma-control">
                  <input id="obs-name" class="bulma-input" :class="{ 'bulma-is-danger': errors.observer_name }" type="text" v-model="form.observer_name" maxlength="80" autocomplete="name" placeholder="Ex.: Ana Carla" :aria-invalid="!!errors.observer_name" aria-describedby="obs-name-error" @input="clearError('observer_name')">
                </div>
                <p v-if="errors.observer_name" id="obs-name-error" class="bulma-help bulma-is-danger">{{ errors.observer_name }}</p>
              </div>
            </div>
            <div class="bulma-column">
              <div class="bulma-field">
                <label class="bulma-label" for="obs-location">Local *</label>
                <div class="bulma-control">
                  <input id="obs-location" class="bulma-input" :class="{ 'bulma-is-danger': errors.location }" type="text" v-model="form.location" maxlength="120" placeholder="Ex.: Florianópolis, SC" :aria-invalid="!!errors.location" aria-describedby="obs-location-error" @input="clearError('location')">
                </div>
                <p v-if="errors.location" id="obs-location-error" class="bulma-help bulma-is-danger">{{ errors.location }}</p>
              </div>
            </div>
          </div>

          <div class="bulma-field">
            <label class="bulma-label" for="obs-notes">Anotações</label>
            <div class="bulma-control">
              <textarea id="obs-notes" class="bulma-textarea" :class="{ 'bulma-is-danger': errors.notes }" v-model="form.notes" rows="3" maxlength="1000" placeholder="O que você viu? Cor, brilho, detalhes…" :aria-invalid="!!errors.notes" aria-describedby="obs-notes-error obs-notes-count" @input="clearError('notes')"></textarea>
            </div>
            <p v-if="errors.notes" id="obs-notes-error" class="bulma-help bulma-is-danger">{{ errors.notes }}</p>
            <p id="obs-notes-count" class="bulma-help">{{ form.notes.length }}/1000</p>
          </div>

          <div v-if="formError" class="bulma-notification bulma-is-danger bulma-is-light" role="alert">{{ formError }}</div>
          <div v-if="success" class="bulma-notification bulma-is-success bulma-is-light" role="status">{{ success }}</div>

          <div class="bulma-field">
            <div class="bulma-control">
              <button class="bulma-button bulma-is-primary bulma-is-fullwidth" :class="{ 'bulma-is-loading': submitting }" type="submit" :disabled="submitting">Registrar observação</button>
            </div>
          </div>
        </form>
      </div>

      <div class="bulma-column">
        <div class="diary-list-head">
          <h3>Observações registradas <span class="bulma-tag bulma-is-primary bulma-is-light">{{ list.total }}</span></h3>
          <div class="bulma-select bulma-is-small">
            <select v-model="list.filter" aria-label="Filtrar observações por astro" @change="setFilter(list.filter)">
              <option value="">Todos os astros</option>
              <optgroup v-for="group in bodyGroups" :key="group.label" :label="group.label">
                <option v-for="body in group.items" :key="body.slug" :value="body.slug">{{ body.name }}</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div v-if="list.error" class="bulma-notification bulma-is-danger bulma-is-light" role="alert">
          {{ list.error }} <button class="bulma-button bulma-is-small" type="button" @click="loadList(true)">Tentar de novo</button>
        </div>
        <p v-else-if="!list.loading && !list.items.length" class="diary-empty">Nenhuma observação ainda. Que tal ser a primeira pessoa a registrar?</p>

        <div class="bulma-columns bulma-is-multiline bulma-is-variable bulma-is-2">
          <div v-for="item in list.items" :key="item.id" class="bulma-column bulma-is-half-desktop bulma-is-full-tablet">
            <article class="diary-card">
              <header>
                <span class="bulma-tag bulma-is-link bulma-is-light">{{ item.body.name }}</span>
                <time :datetime="item.observed_at">{{ dateLong(item.observed_at) }}</time>
              </header>
              <p class="diary-stars" :aria-label="'Qualidade do céu: ' + item.sky_quality + ' de 5'">{{ stars(item.sky_quality) }}</p>
              <p v-if="item.notes" class="diary-notes">{{ item.notes }}</p>
              <footer>
                <span>{{ item.observer_name }} · {{ item.location }}</span>
                <span class="bulma-tag bulma-is-dark">{{ item.instrument_label }}</span>
                <button v-if="canDelete(item)" class="bulma-delete bulma-is-small" type="button" :aria-label="'Apagar observação de ' + item.body.name" title="Apagar (só quem registrou)" @click="remove(item)"></button>
              </footer>
            </article>
          </div>
        </div>
        <button v-if="hasMore" class="bulma-button bulma-is-small bulma-is-link bulma-is-outlined" :class="{ 'bulma-is-loading': list.loading }" type="button" @click="loadList(false)">Ver mais observações</button>
      </div>
    </div>
  </section>`,
};
