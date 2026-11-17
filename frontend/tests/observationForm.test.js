import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { ATLAS_API_BASE: '' };
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
};

const { api } = await import('../js/api.js');
const { default: useObservationForm, toPayload, emptyForm } = await import('../js/components/blog/useObservationForm.js');

const original = { ...api };
const restore = () => Object.assign(api, original);

const created = {
  id: 7,
  body: { slug: 'saturno', name: 'Saturno', category: 'planet', kind: 'Planeta' },
  observer_name: 'Ana Carla',
  observed_at: '2026-11-14',
  location: 'Florianópolis',
  instrument: 'binoculo',
  instrument_label: 'Binóculo',
  sky_quality: 5,
  notes: '',
  created_at: '2026-11-16T12:00:00',
  delete_token: 'segredo-123',
};

test('toPayload trims text and converts the sky quality to a number', () => {
  const payload = toPayload({ ...emptyForm(), observer_name: '  Ana ', sky_quality: '4', notes: '  ok  ' });
  assert.equal(payload.observer_name, 'Ana');
  assert.equal(payload.sky_quality, 4);
  assert.equal(payload.notes, 'ok');
  assert.equal(toPayload(emptyForm()).sky_quality, null);
});

test('server validation errors are shown next to each field', async t => {
  t.after(restore);
  let sent;
  api.createObservation = async data => {
    sent = data;
    const err = new Error('Confira os campos destacados.');
    err.status = 422;
    err.fields = { body_slug: 'Campo obrigatório.', sky_quality: 'O valor máximo é 5.' };
    throw err;
  };
  const diary = useObservationForm();
  diary.form.sky_quality = '9';
  assert.equal(await diary.submit(), null);
  assert.deepEqual(diary.errors.value, { body_slug: 'Campo obrigatório.', sky_quality: 'O valor máximo é 5.' });
  assert.equal(diary.formError.value, 'Confira os campos destacados.');
  // Campos obrigatórios vazios não são enviados: o servidor é quem diz "Campo obrigatório."
  assert.ok(!('body_slug' in sent));
  assert.equal(sent.sky_quality, 9);
  diary.clearError('sky_quality');
  assert.deepEqual(diary.errors.value, { body_slug: 'Campo obrigatório.' });
});

test('a saved observation is listed, the form is reset and the delete token is kept', async t => {
  t.after(restore);
  store.clear();
  api.createObservation = async () => ({ ...created });
  const diary = useObservationForm();
  Object.assign(diary.form, { body_slug: 'saturno', observer_name: 'Ana Carla', location: 'Florianópolis', sky_quality: '5' });
  const item = await diary.submit();
  assert.equal(item.id, 7);
  assert.ok(!('delete_token' in item));
  assert.equal(diary.list.items[0].id, 7);
  assert.equal(diary.list.total, 1);
  assert.equal(diary.form.body_slug, '');
  assert.equal(diary.form.observer_name, 'Ana Carla');
  assert.match(diary.success.value, /Saturno/);
  assert.equal(JSON.parse(store.get('atlas.observations.tokens'))[7], 'segredo-123');
  assert.equal(diary.canDelete(item), true);
});

test('remove sends the stored token and drops the card', async t => {
  t.after(restore);
  let call;
  api.deleteObservation = async (id, token) => { call = { id, token }; return null; };
  const diary = useObservationForm();
  diary.list.items = [{ ...created }];
  diary.list.total = 1;
  assert.equal(await diary.remove({ id: 7 }), true);
  assert.deepEqual(call, { id: 7, token: 'segredo-123' });
  assert.equal(diary.list.items.length, 0);
  assert.equal(diary.canDelete({ id: 7 }), false);
});

test('network errors keep the form data and show a message', async t => {
  t.after(restore);
  api.createObservation = async () => { throw new Error('Não foi possível conectar ao servidor do Atlas.'); };
  const diary = useObservationForm();
  diary.form.observer_name = 'Lara';
  await diary.submit();
  assert.equal(diary.form.observer_name, 'Lara');
  assert.match(diary.formError.value, /conectar/);
  assert.deepEqual(diary.errors.value, {});
});
