import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountClient, safeReturnUrl } from '../assets/js/connect-auth.mjs';

function fixture() {
  const calls = [];
  const client = createAccountClient({ url: 'https://auth.example', anonKey: 'public' }, async (url, init) => {
    calls.push({ url, ...init, body: init.body && JSON.parse(init.body) });
    if (url.endsWith('/verify')) return Response.json({ access_token: 'account-secret', user: { id: 'u1', email: 'a@example.com', is_anonymous: false } });
    if (url.endsWith('/user')) return Response.json({ id: 'u1', email: 'a@example.com', is_anonymous: false });
    return Response.json({});
  });
  return { client, calls };
}
test('email code signup is explicit, normalized, and verified before account calls', async () => {
  const { client, calls } = fixture();
  await assert.rejects(client.grants(), /Sign in/);
  await client.sendCode(' A@EXAMPLE.COM ', true);
  assert.deepEqual(calls[0].body, { email: 'a@example.com', create_user: true });
  await client.verifyCode('a@example.com', '123456');
  assert.equal((await client.user()).id, 'u1');
  assert.equal(calls.at(-1).headers.authorization, 'Bearer account-secret');
  assert.equal(calls[0].redirect, 'error');
});
test('sign in does not create users; invalid codes and identifiers never reach the network', async () => {
  const { client, calls } = fixture();
  await client.sendCode('a@example.com', false);
  assert.equal(calls[0].body.create_user, false);
  await assert.rejects(client.verifyCode('a@example.com', 'x'), /code/);
  await assert.rejects(client.authorization('../user'), /connection/);
  assert.equal(calls.length, 1);
});
test('grants are removed only using the selected native client id', async () => {
  const { client, calls } = fixture();
  await client.verifyCode('a@example.com', '123456');
  await client.revoke('11111111-1111-4111-8111-111111111111');
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(calls.at(-1).url, 'https://auth.example/auth/v1/user/oauth/grants?client_id=11111111-1111-4111-8111-111111111111');
});
test('native authorization request identifiers are opaque, not OAuth client UUIDs', async () => {
  const { client, calls } = fixture();
  await client.verifyCode('a@example.com', '123456');
  const authorization = 'abcdefghijklmnopqrstuvwxyz012345';
  await client.authorization(authorization);
  await client.decide(authorization, false);
  assert.equal(calls.at(-1).url, `https://auth.example/auth/v1/oauth/authorizations/${authorization}/consent`);
  assert.deepEqual(calls.at(-1).body, { action: 'deny' });
  await assert.rejects(client.revoke(authorization), /connection/);
});
test('unsafe redirects and anonymous accounts are refused', async () => {
  for (const target of ['javascript:alert(1)', 'https://user:pass@example.com', 'http://external.example']) assert.throws(() => safeReturnUrl(target));
  assert.equal(safeReturnUrl('https://chatgpt.com/connector_platform/oauth/callback?code=test').hostname, 'chatgpt.com');
  const client = createAccountClient({ url: 'https://auth.example', anonKey: 'public' }, async () => Response.json({ access_token: 'x', user: { id: 'u1', is_anonymous: true } }));
  await assert.rejects(client.verifyCode('a@example.com', '123456'), /account/);
});
test('native errors are safe, and an expired page session is cleared', async () => {
  const client = createAccountClient({ url: 'https://auth.example', anonKey: 'public' }, async () => Response.json({ message: 'private diagnostic' }, { status: 401 }));
  await assert.rejects(client.verifyCode('a@example.com', '123456'), (error) => !error.message.includes('private diagnostic'));
  await assert.rejects(client.grants(), /Sign in/);
});
test('account terms require both explicit declarations and use the verified app session', async () => {
  const { client, calls } = fixture();
  await client.verifyCode('a@example.com', '123456');
  await assert.rejects(async () => client.acceptTerms(false, true));
  await client.acceptTerms(true, true);
  assert.equal(calls.at(-1).url, 'https://auth.example/rest/v1/rpc/mcp_accept_account_terms');
  assert.equal(calls.at(-1).headers.authorization, 'Bearer account-secret');
  assert.deepEqual(calls.at(-1).body, {});
});
