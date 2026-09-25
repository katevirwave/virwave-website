import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('expired provider state returns to the account page, not the marketing homepage', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.deepEqual(config.redirects.find((rule) => rule.source === '/'), {
    source: '/', has: [{ type: 'query', key: 'error_code', value: 'bad_oauth_state' }],
    destination: '/account', permanent: false,
  });
});

test('legacy Google consent privacy link resolves to the current policy', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.deepEqual(config.redirects.find((rule) => rule.source === '/pages/privacy-policy'), {
    source: '/pages/privacy-policy', destination: '/privacy', permanent: true,
  });
});

test('MCP discovery supports the challenge URL and standard path fallback', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  const target = 'https://xswebtvkueusdaeboizp.supabase.co/functions/v1/breathe-connected/.well-known/oauth-protected-resource';
  for (const source of ['/mcp/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
    assert.equal(config.rewrites.find((rule) => rule.source === source)?.destination, target);
  }
  const headers = config.headers.find((rule) => rule.source === '/.well-known/oauth-protected-resource/:path*')?.headers;
  assert.ok(headers?.some(({ key, value }) => key === 'Cache-Control' && value === 'no-store'));
});
