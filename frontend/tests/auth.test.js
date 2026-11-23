import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthenticatedUser, isAuthenticated, login, register } from '../js/auth.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

test('login stores session identity without persisting the password', () => {
  const storage = memoryStorage();

  assert.deepEqual(login('  pessoa@example.com ', 'senha123', storage), {
    ok: true,
    email: 'pessoa@example.com',
    name: 'pessoa',
  });
  assert.equal(isAuthenticated(storage), true);
  assert.deepEqual(getAuthenticatedUser(storage), { email: 'pessoa@example.com', name: 'pessoa' });
  assert.equal(storage.values.has('atlas.user.password'), false);
});

test('login rejects invalid email and short passwords', () => {
  const storage = memoryStorage();

  assert.equal(login('email-invalido', 'senha123', storage).ok, false);
  assert.equal(login('pessoa@example.com', '123', storage).ok, false);
  assert.equal(isAuthenticated(storage), false);
});

test('registration validates input before starting an authenticated session', () => {
  const storage = memoryStorage();

  assert.equal(register('A', 'pessoa@example.com', 'senha123', 'senha123', storage).ok, false);
  assert.equal(register('Pessoa', 'pessoa@example.com', 'senha123', 'diferente', storage).ok, false);
  assert.equal(register('Pessoa', 'pessoa@example.com', 'senha123', 'senha123', storage).ok, true);
  assert.equal(isAuthenticated(storage), true);
  assert.deepEqual(getAuthenticatedUser(storage), { email: 'pessoa@example.com', name: 'Pessoa' });
});