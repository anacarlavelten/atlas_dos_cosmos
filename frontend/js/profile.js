const PROFILE_KEY_PREFIX = 'atlas.profile.v1:';

function keyFor(email) {
  return PROFILE_KEY_PREFIX + encodeURIComponent(email.trim().toLowerCase());
}

function emptyProfile(name) {
  return {
    name: name || 'Observador',
    bio: 'Observador de Estrelas / Entusiasta do Cosmos',
    location: 'Terra, Sistema Solar',
    posts: [],
  };
}

export function loadProfile(email, name, storage = globalThis.localStorage) {
  const fallback = emptyProfile(name);
  if (!storage) {
    return { profile: fallback, error: 'O armazenamento local não está disponível.', exists: false };
  }

  let value;
  try {
    value = storage.getItem(keyFor(email));
  } catch {
    return { profile: fallback, error: 'Não foi possível ler os dados locais do perfil.', exists: false };
  }
  if (!value) return { profile: fallback, error: '', exists: false };

  try {
    const saved = JSON.parse(value);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new TypeError('Perfil inválido');
    return {
      profile: {
        name: typeof saved.name === 'string' ? saved.name : fallback.name,
        bio: typeof saved.bio === 'string' ? saved.bio : fallback.bio,
        location: typeof saved.location === 'string' ? saved.location : fallback.location,
        posts: Array.isArray(saved.posts) ? saved.posts : [],
      },
      error: '',
      exists: true,
    };
  } catch {
    return { profile: fallback, error: 'Os dados locais do perfil estão inválidos.', exists: true };
  }
}

export function saveProfile(email, profile, storage = globalThis.localStorage) {
  if (!storage) return { ok: false, error: 'O armazenamento local não está disponível.' };
  try {
    storage.setItem(keyFor(email), JSON.stringify({
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
      posts: profile.posts,
    }));
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: 'Não foi possível salvar. O armazenamento local pode estar cheio ou indisponível.' };
  }
}
