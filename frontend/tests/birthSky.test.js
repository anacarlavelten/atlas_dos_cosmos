import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, nextTick } from '../vendor/vue.esm-browser.prod.js';

globalThis.window = { ATLAS_API_BASE: '' };
const { api } = await import('../js/api.js');
const { default: useBirthSky, APOD_FIRST_DATE } = await import('../js/components/blog/useBirthSky.js');

const renderer = createRenderer({
  createElement: type => ({ type, children: [], parent: null }),
  createText: text => ({ text, parent: null }),
  createComment: text => ({ text, parent: null }),
  setText: (node, text) => { node.text = text; },
  setElementText: (node, text) => { node.text = text; },
  insert: (node, parent) => {
    node.parent = parent;
    parent.children.push(node);
  },
  remove: node => { node.parent = null; },
  parentNode: node => node.parent,
  nextSibling: () => null,
});

const originalApi = { apodForDate: api.apodForDate, birthImages: api.birthImages };

function setBrowserGlobals() {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { href: 'https://atlas.example/blog', search: '' },
  });
}

async function mountSky(t) {
  setBrowserGlobals();
  let sky;
  const app = renderer.createApp({
    setup() {
      sky = useBirthSky();
      return () => null;
    },
  });
  app.mount({ children: [] });
  await nextTick();
  t.after(() => {
    app.unmount();
    api.apodForDate = originalApi.apodForDate;
    api.birthImages = originalApi.birthImages;
  });
  return sky;
}

const apod = (date, overrides = {}) => ({
  date,
  title: 'Nebulosa de exemplo',
  explanation: 'Descrição da imagem astronômica.',
  media_type: 'image',
  url: 'https://images.example/apod.jpg',
  hdurl: 'https://images.example/apod-hd.jpg',
  thumbnail_url: null,
  copyright: 'NASA',
  page_url: 'https://apod.nasa.gov/apod/example.html',
  ...overrides,
});

test('loads a valid APOD date and preserves the video response', async t => {
  const sky = await mountSky(t);
  api.apodForDate = async date => apod(date, {
    media_type: 'video',
    url: 'https://video.example/watch',
    thumbnail_url: 'https://images.example/video-thumb.jpg',
  });
  await sky.load('2001-02-03');
  assert.equal(sky.result.value.media_type, 'video');
  assert.equal(sky.result.value.thumbnail_url, 'https://images.example/video-thumb.jpg');
  assert.equal(sky.error.value, '');
});

test('uses the closest NASA Library image for a pre-APOD birth date', async t => {
  const sky = await mountSky(t);
  api.birthImages = async year => ({
    year,
    images: [
      { nasa_id: 'far', date_created: `${year}-01-01T00:00:00Z`, title: 'Distante', thumbnail: 'https://img.example/far.jpg' },
      { nasa_id: 'near', date_created: `${year}-06-15T00:00:00Z`, title: 'Próxima', thumbnail: 'https://img.example/near.jpg' },
    ],
  });
  await sky.load('1990-06-16');
  assert.equal(sky.historicalImages.value[0].nasa_id, 'near');
  assert.equal(sky.result.value, null);
});

test('falls back to the first APOD when the image library has no result', async t => {
  const sky = await mountSky(t);
  api.birthImages = async year => ({ year, images: [] });
  api.apodForDate = async date => apod(date);
  await sky.load('1900-06-16');
  assert.equal(sky.result.value.date, APOD_FIRST_DATE);
  assert.equal(sky.resultLabel.value, 'Primeira APOD da história · 16 de junho de 1995');
});

test('rejects future dates without making an API request', async t => {
  const sky = await mountSky(t);
  let calls = 0;
  api.apodForDate = async () => { calls += 1; };
  const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await sky.load(future);
  assert.equal(calls, 0);
  assert.match(sky.error.value, /já aconteceu/);
});

test('exposes rate-limit and network errors without clearing the page', async t => {
  const sky = await mountSky(t);
  api.apodForDate = async () => {
    const error = new Error('Limite temporário');
    error.status = 429;
    throw error;
  };
  await sky.load('2002-03-04');
  assert.match(sky.error.value, /cota da NASA/);

  api.apodForDate = async () => { throw new Error('Sem conexão'); };
  await sky.load('2002-03-05', true);
  assert.equal(sky.error.value, 'Sem conexão');
});
