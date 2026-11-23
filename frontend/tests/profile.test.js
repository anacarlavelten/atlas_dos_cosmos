import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile, saveProfile } from '../js/profile.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('profile posts persist locally and remain isolated by user email', () => {
  const storage = memoryStorage();
  const alice = loadProfile('alice@example.com', 'Alice', storage).profile;
  alice.posts.push({ id: 'one', title: 'Lua crescente', story: 'Céu limpo', image: 'data:image/jpeg;base64,abc' });

  assert.equal(saveProfile('alice@example.com', alice, storage).ok, true);
  assert.equal(loadProfile('alice@example.com', 'Alice', storage).profile.posts.length, 1);
  assert.equal(loadProfile('bob@example.com', 'Bob', storage).profile.posts.length, 0);
});

test('profile storage reports unavailable persistence explicitly', () => {
  assert.equal(saveProfile('alice@example.com', { posts: [] }, null).ok, false);
  assert.match(loadProfile('alice@example.com', 'Alice', null).error, /não está disponível/i);
});
