import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { startProviderLogin, consumeProviderReturn } from '../assets/js/connect-auth.mjs';
const storage = () => { const data = new Map(); return { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }; };
test('a verified provider cancellation retains assistant context for email fallback, once only', async () => {
  const store = storage();
  const url = await startProviderLogin('https://auth.example', 'google', 'https://virwave.com/connect', 'abcdefghijklmnopqrstuvwxyz012345', store, webcrypto);
  const callback = new URL(url.searchParams.get('redirect_to'));
  callback.searchParams.set('error', 'access_denied');
  assert.deepEqual(consumeProviderReturn(callback, store), { authorizationId: 'abcdefghijklmnopqrstuvwxyz012345', error: true, code: null });
  assert.throws(() => consumeProviderReturn(callback, store), /Restart/);
});
test('social login uses S256 and binds the one-use return to this browser attempt', async () => {
  const store = storage();
  const url = await startProviderLogin('https://auth.example', 'google', 'https://virwave.com/connect/', '11111111-1111-4111-8111-111111111111', store, webcrypto);
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  const callback = new URL(url.searchParams.get('redirect_to'));
  callback.searchParams.set('code', 'one-use-code');
  const pending = consumeProviderReturn(callback, store);
  assert.equal(pending.authorizationId, '11111111-1111-4111-8111-111111111111');
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier));
  assert.equal(Buffer.from(digest).toString('base64url'), url.searchParams.get('code_challenge'));
  assert.throws(() => consumeProviderReturn(callback, store), /Restart/);
});
test('wrong state, origin, or provider is rejected', async () => {
  await assert.rejects(startProviderLogin('https://auth.example', 'evil', 'https://virwave.com/connect/', null, storage(), webcrypto));
  const store = storage();
  const url = await startProviderLogin('https://auth.example', 'apple', 'https://virwave.com/connect/', null, store, webcrypto);
  const callback = new URL(url.searchParams.get('redirect_to'));
  callback.searchParams.set('code', 'code'); callback.searchParams.set('login_state', 'wrong');
  assert.throws(() => consumeProviderReturn(callback, store), /Restart/);
});
test('provider returns cannot change origin or reuse an expired browser attempt', async () => {
  for (const mutation of ['origin', 'expired']) {
    const store = storage();
    const url = await startProviderLogin('https://auth.example', 'apple', 'https://virwave.com/connect', 'abcdefghijklmnopqrstuvwxyz012345', store, webcrypto);
    const callback = new URL(url.searchParams.get('redirect_to')); callback.searchParams.set('code', 'code');
    if (mutation === 'origin') callback.hostname = 'evil.example';
    else { const pending = JSON.parse(store.getItem('virwave-connect-pkce')); pending.createdAt = Date.now() - 601_000; store.setItem('virwave-connect-pkce', JSON.stringify(pending)); }
    assert.throws(() => consumeProviderReturn(callback, store), /Restart/);
    assert.equal(store.getItem('virwave-connect-pkce'), undefined);
  }
});
