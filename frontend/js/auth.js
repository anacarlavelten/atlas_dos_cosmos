const SESSION_KEY = 'atlas.authenticated';
const SESSION_EMAIL_KEY = 'atlas.user.email';
const SESSION_NAME_KEY = 'atlas.user.name';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export function isAuthenticated(storage = globalThis.sessionStorage) {
  return storage?.getItem(SESSION_KEY) === 'true';
}

function startSession(email, name, storage) {
  if (!storage) {
    return { ok: false, error: 'O armazenamento da sessão não está disponível.' };
  }
  storage.setItem(SESSION_EMAIL_KEY, email);
  storage.setItem(SESSION_NAME_KEY, name);
  storage.setItem(SESSION_KEY, 'true');
  return { ok: true, email, name };
}

export function getAuthenticatedUser(storage = globalThis.sessionStorage) {
  if (!isAuthenticated(storage)) return null;
  const email = storage.getItem(SESSION_EMAIL_KEY) || 'observador@atlas.local';
  const name = storage.getItem(SESSION_NAME_KEY) || email.split('@')[0] || 'Observador';
  return { email, name };
}

export function login(email, password, storage = globalThis.sessionStorage) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }
  return startSession(normalizedEmail, normalizedEmail.split('@')[0], storage);
}

export function register(name, email, password, confirmation, storage = globalThis.sessionStorage) {
  if (typeof name !== 'string' || name.trim().length < 2) {
    return { ok: false, error: 'Informe seu nome.' };
  }
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }
  if (password !== confirmation) {
    return { ok: false, error: 'As senhas não coincidem.' };
  }
  return startSession(normalizedEmail, name.trim(), storage);
}