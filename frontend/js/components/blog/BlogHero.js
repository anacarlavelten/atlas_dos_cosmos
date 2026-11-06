/* Destaques do topo do blog: a imagem astronômica do dia (NASA APOD) e a
   contagem regressiva para o próximo lançamento orbital (Launch Library 2). */
import { ref, computed, onMounted } from 'vue';
import { api, once } from '../../api.js';
import { store } from '../../store.js';
import { now, ago, countdown, dateLong, dateTime, hideBroken } from './format.js';

export default {
  name: 'BlogHero',
  setup() {
    const apod = ref(null), apodErr = ref(null);
    const launches = ref(null), launchErr = ref(null);

    /* Se o APOD estiver fora do ar, o destaque passa a ser a publicação mais
       recente com imagem (preferindo as marcadas como destaque pela fonte). */
    const lead = ref(null);
    const loadLead = () => api.blogFeed({ kind: 'articles', topic: 'tudo', offset: 0, limit: 12 }).then(d => {
      const withImg = d.posts.filter(p => p.image_url);
      lead.value = withImg.find(p => p.featured) || withImg[0] || null;
    }, () => {});

    onMounted(() => {
      once('apod', api.apod).then(d => { apod.value = d; }, e => { apodErr.value = e.message; loadLead(); });
      once('launches', api.blogLaunches).then(d => { launches.value = d; }, e => { launchErr.value = e.message; });
    });

    const apodImage = computed(() => {
      const a = apod.value;
      if (!a) return null;
      return a.media_type === 'video' ? a.thumbnail_url : a.url;
    });
    /* Primeiro lançamento que ainda não aconteceu (a lista pode trazer um que acabou de sair). */
    const next = computed(() => {
      const list = launches.value?.launches || [];
      return list.find(l => Date.parse(l.net) > now.value - 3600e3) || list[0] || null;
    });
    const t = computed(() => (next.value?.net ? countdown(next.value.net, now.value) : null));

    return { store, apod, apodErr, apodImage, lead, ago, now, launches, launchErr, next, t, dateLong, dateTime, hideBroken };
  },
  template: `
  <section class="hero" aria-label="Destaques">
    <article class="panel apod-hero" data-img>
      <template v-if="apod">
        <img v-if="apodImage" class="apod-bg" :src="apodImage" :alt="apod.title" @error="hideBroken" loading="eager">
        <div class="apod-shade"></div>
        <div class="apod-text">
          <span class="chip" style="--c: var(--sun)"><i></i>Imagem astronômica do dia · NASA APOD</span>
          <h2>{{ apod.title }}</h2>
          <p class="clamp-3" lang="en">{{ apod.explanation }}</p>
          <div class="meta">
            <span>{{ dateLong(apod.date) }}</span>
            <span v-if="apod.copyright">© {{ apod.copyright }}</span>
            <span v-if="apod.stale">dados guardados</span>
          </div>
          <div class="row">
            <button class="act sm-act" @click="store.apodOpen = true">Ver em tela cheia</button>
            <a class="ghost" :href="apod.page_url" target="_blank" rel="noopener">Site do APOD ↗</a>
          </div>
        </div>
      </template>
      <template v-else-if="apodErr && lead">
        <img class="apod-bg" :src="lead.image_url" alt="" @error="hideBroken">
        <div class="apod-shade"></div>
        <div class="apod-text">
          <span class="chip" style="--c: var(--sky)"><i></i>Em destaque · {{ lead.news_site }}</span>
          <h2>{{ lead.title }}</h2>
          <p class="clamp-3" lang="en" v-if="lead.summary">{{ lead.summary }}</p>
          <div class="meta">
            <span>{{ ago(lead.published_at, now) }}</span>
            <span>A imagem astronômica do dia (NASA APOD) está indisponível no momento.</span>
          </div>
          <div class="row"><a class="act sm-act" :href="lead.url" target="_blank" rel="noopener">Ler a publicação ↗</a></div>
        </div>
      </template>
      <div v-else-if="apodErr" class="apod-text"><span class="chip" style="--c: var(--sun)"><i></i>Imagem do dia</span><p class="muted">{{ apodErr }}</p></div>
      <div v-else class="skel fill"></div>
    </article>

    <article class="panel next-launch">
      <span class="chip" style="--c: var(--rose)"><i></i>Próximo lançamento</span>
      <template v-if="next">
        <h3>{{ next.name }}</h3>
        <div class="count" v-if="t" :aria-label="'Faltam ' + t.d + ' dias, ' + t.h + ' horas e ' + t.m + ' minutos'">
          <span class="tsign">T{{ t.sign }}</span>
          <span><b>{{ t.d }}</b><small>dias</small></span>
          <span><b>{{ t.h }}</b><small>horas</small></span>
          <span><b>{{ t.m }}</b><small>min</small></span>
          <span><b>{{ t.s }}</b><small>seg</small></span>
        </div>
        <dl>
          <dt>Data</dt><dd>{{ dateTime(next.net) }}<small v-if="next.net_precision && next.net_precision !== 'Second' && next.net_precision !== 'Minute'"> · precisão: {{ next.net_precision }}</small></dd>
          <template v-if="next.status"><dt>Situação</dt><dd><span class="status" :class="'st-' + (next.status_abbrev || '').toLowerCase()">{{ next.status }}</span></dd></template>
          <template v-if="next.provider"><dt>Operador</dt><dd>{{ next.provider }}</dd></template>
          <template v-if="next.rocket"><dt>Foguete</dt><dd>{{ next.rocket }}</dd></template>
          <template v-if="next.orbit && next.orbit !== 'Unknown'"><dt>Órbita</dt><dd>{{ next.orbit }}</dd></template>
          <template v-if="next.location"><dt>Local</dt><dd>{{ next.location }}</dd></template>
        </dl>
        <a class="linkbtn" :href="next.page_url" target="_blank" rel="noopener">Detalhes no Space Launch Now ↗</a>
      </template>
      <p v-else-if="launchErr" class="muted">{{ launchErr }}</p>
      <div v-else class="skel" style="aspect-ratio:auto;height:220px;margin-top:10px"></div>
    </article>
  </section>`,
};
