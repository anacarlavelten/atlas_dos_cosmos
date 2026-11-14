import test from 'node:test';
import assert from 'node:assert/strict';
import PostImage from '../js/components/blog/PostImage.js';
import { normalizeImageUrl, useImageHealth } from '../js/components/blog/useImageHealth.js';

function stateFor(src, fallbackSrc = '') {
  const state = {
    ...PostImage.data(),
    ...PostImage.methods,
    src,
    fallbackSrc,
    loaded: false,
    failed: false,
  };
  PostImage.methods.resetImage.call(state);
  return state;
}

test('retries the alternate image before rendering its fallback', () => {
  const state = stateFor('https://broken.example/image.jpg', 'https://backup.example/image.jpg');
  PostImage.methods.handleError.call(state);
  assert.equal(state.currentIndex, 1);
  assert.equal(state.failed, false);
  PostImage.methods.handleError.call(state);
  assert.equal(state.failed, true);

  const failed = useImageHealth().failedUrls.value;
  assert.ok(failed.has('https://broken.example/image.jpg'));
  assert.ok(failed.has('https://backup.example/image.jpg'));
});

test('a tracking pixel is rejected and exposes a fallback', () => {
  const state = stateFor('https://pixel.example/p.gif');
  PostImage.methods.handleLoad.call(state, { target: { naturalWidth: 1, naturalHeight: 1 } });
  assert.equal(state.failed, true);
  assert.equal(state.loaded, false);
});

test('does not retry a URL already recorded as broken', () => {
  const url = 'https://known-broken.example/image.jpg';
  useImageHealth().markFailed(url);
  const state = stateFor(url);
  assert.equal(state.failed, true);
  assert.deepEqual(state.candidates, []);
});

test('sets referrer policy and descriptive alternative text on the image', () => {
  assert.match(PostImage.template, /referrerpolicy="no-referrer"/);
  assert.match(PostImage.template, /:alt="alt"/);
  assert.match(PostImage.template, /decoding="async"/);
  assert.match(PostImage.template, /:loading="loading"/);
});

test('normalizes relative, protocol-relative, and insecure URLs on HTTPS pages', () => {
  const previous = globalThis.location;
  globalThis.location = { href: 'https://atlas.example/blog', protocol: 'https:' };
  try {
    assert.equal(normalizeImageUrl('//cdn.example/image.jpg'), 'https://cdn.example/image.jpg');
    assert.equal(normalizeImageUrl('/assets/image.jpg'), 'https://atlas.example/assets/image.jpg');
    assert.equal(normalizeImageUrl('http://cdn.example/image.jpg'), 'https://cdn.example/image.jpg');
  } finally {
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  }
});
