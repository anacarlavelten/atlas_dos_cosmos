import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, nextTick } from '../vendor/vue.esm-browser.prod.js';
import { useCountdown } from '../js/components/blog/useCountdown.js';
import { futureLaunches } from '../js/components/blog/launches.js';

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

async function mountCountdown(target) {
  let state;
  const app = renderer.createApp({
    setup() {
      state = useCountdown(target);
      return () => null;
    },
  });
  app.mount({ children: [] });
  await nextTick();
  return { app, state };
}

function fakeClock(t) {
  const originalNow = Date.now;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let tick;
  const cleared = [];
  Date.now = () => t;
  globalThis.setInterval = callback => { tick = callback; return 42; };
  globalThis.clearInterval = id => { cleared.push(id); };
  return {
    advance(ms) { t += ms; tick?.(); },
    cleared,
    restore() {
      Date.now = originalNow;
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    },
  };
}

test('formats a normal countdown into days, hours, minutes, and seconds', async t => {
  const clock = fakeClock(Date.UTC(2026, 0, 1));
  t.after(() => clock.restore());
  const target = new Date(Date.now() + (((2 * 24 + 3) * 60 + 4) * 60 + 5) * 1000).toISOString();
  const { app, state } = await mountCountdown(target);
  t.after(() => app.unmount());
  assert.equal(state.status.value, 'countdown');
  assert.deepEqual(state.parts.value, { days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.match(state.ariaLabel.value, /2 dias, 3 horas, 4 minutos e 5 segundos/);
});

test('reports T-0 at the target instant', async t => {
  const target = Date.UTC(2026, 0, 1);
  const clock = fakeClock(target);
  t.after(() => clock.restore());
  const { app, state } = await mountCountdown(new Date(target).toISOString());
  t.after(() => app.unmount());
  assert.equal(state.status.value, 'launching');
  assert.equal(state.compact.value, 'T-0');
});

test('marks an elapsed launch as passed', async t => {
  const clock = fakeClock(Date.UTC(2026, 0, 1));
  t.after(() => clock.restore());
  const { app, state } = await mountCountdown(new Date(Date.now() - 1).toISOString());
  t.after(() => app.unmount());
  assert.equal(state.status.value, 'passed');
});

test('shows TBD when no usable target date is available', async t => {
  const clock = fakeClock(Date.UTC(2026, 0, 1));
  t.after(() => clock.restore());
  const { app, state } = await mountCountdown(undefined);
  t.after(() => app.unmount());
  assert.equal(state.status.value, 'tbd');
  assert.equal(state.compact.value, 'Data a confirmar');
});

test('clears the interval when the countdown unmounts', async t => {
  const clock = fakeClock(Date.UTC(2026, 0, 1));
  t.after(() => clock.restore());
  const { app } = await mountCountdown(new Date(Date.now() + 60_000).toISOString());
  app.unmount();
  assert.deepEqual(clock.cleared, [42]);
});

test('removes elapsed launches and promotes the next scheduled launch', () => {
  const now = Date.UTC(2026, 0, 1);
  const launches = futureLaunches([
    { id: 'passed', net: new Date(now - 1).toISOString() },
    { id: 'later', net: new Date(now + 60_000).toISOString() },
    { id: 'sooner', net: new Date(now + 10_000).toISOString() },
    { id: 'tbd', net: null },
  ], now);
  assert.deepEqual(launches.map(launch => launch.id), ['sooner', 'later', 'tbd']);
});
