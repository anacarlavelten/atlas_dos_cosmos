import { reactive } from 'vue';
import { store } from '../store.js';
import { login, register } from '../auth.js';

export default {
  name: 'LoginModal',
  setup() {
    const form = reactive({ name: '', email: '', password: '' });

    function close() {
      store.authModalOpen = false;
      store.authError = '';
      store.pendingAuthDestination = null;
    }

    function setMode(mode) {
      store.authMode = mode;
      store.authError = '';
      form.password = '';
    }

    function submit() {
      const result = store.authMode === 'register'
        ? register(form.name, form.email, form.password, form.password)
        : login(form.email, form.password);
      if (!result.ok) {
        store.authError = result.error;
        return;
      }

      store.authenticated = true;
      store.authModalOpen = false;
      store.authError = '';
      const destination = store.pendingAuthDestination;
      store.pendingAuthDestination = null;
      if (destination === 'sim') location.hash = '#/simulador';
      else if (destination === 'profile') location.hash = '#/perfil';
    }

    return { store, form, close, setMode, submit };
  },
  template: `
  <div v-if="store.authModalOpen" class="auth-overlay" @click.self="close">
    <section class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button class="auth-close" type="button" aria-label="Fechar" @click="close">×</button>
      <span class="auth-eyebrow">ATLAS DO COSMOS</span>
      <h2 id="auth-title" class="auth-title">
        <template v-if="store.authMode === 'register'"><span>Crie</span> <span class="auth-title-muted">sua conta</span></template>
        <template v-else><span>Entre</span> <span class="auth-title-muted">na sua conta</span></template>
      </h2>
      <p class="auth-subtitle">
        {{ store.authMode === 'register' ? 'Comece sua jornada pelo universo.' : 'Acesse sua conta para continuar explorando.' }}
      </p>
      <form class="auth-form" @submit.prevent="submit">
        <label v-if="store.authMode === 'register'" class="auth-field" for="auth-name">
          <span>Nome</span>
          <input id="auth-name" v-model="form.name" autocomplete="name" minlength="2" placeholder="Seu nome" required>
        </label>
        <label class="auth-field" for="auth-email">
          <span>E-mail</span>
          <input id="auth-email" v-model="form.email" type="email" autocomplete="email" placeholder="nome@exemplo.com" required>
        </label>
        <label class="auth-field" for="auth-password">
          <span>Senha</span>
          <input id="auth-password" v-model="form.password" type="password" :autocomplete="store.authMode === 'register' ? 'new-password' : 'current-password'" minlength="6" placeholder="Mínimo de 6 caracteres" required>
        </label>
        <p v-if="store.authError" class="auth-error" role="alert">{{ store.authError }}</p>
        <button class="auth-submit" type="submit">{{ store.authMode === 'register' ? 'Cadastrar-se' : 'Entrar' }}</button>
      </form>
      <p class="auth-footer">
        {{ store.authMode === 'register' ? 'Já tem uma conta?' : 'Ainda não tem uma conta?' }}
        <button class="auth-switch" type="button" @click="setMode(store.authMode === 'register' ? 'login' : 'register')">
          {{ store.authMode === 'register' ? 'Entrar' : 'Cadastrar-se' }}
        </button>
      </p>
    </section>
  </div>`,
};