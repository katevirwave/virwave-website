import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';

test('account page: signup, code, consent, removal, mobile, and no credential persistence', { skip: !process.env.VIRWAVE_PLAYWRIGHT }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.VIRWAVE_PLAYWRIGHT));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url, 'http://test');
    const routing = JSON.parse(await readFile(resolve(root, 'vercel.json')));
    const redirect = routing.redirects.find((rule) => rule.source === requestUrl.pathname &&
      (rule.has || []).every((condition) => condition.type === 'query' && requestUrl.searchParams.get(condition.key) === condition.value) &&
      (rule.missing || []).every((condition) => condition.type === 'query' && !requestUrl.searchParams.has(condition.key)));
    if (redirect) { res.writeHead(307, { location: redirect.destination + requestUrl.search }).end(); return; }
    const rewrite = routing.rewrites.find((rule) => rule.source === requestUrl.pathname && rule.destination.startsWith('/'));
    const pathname = decodeURIComponent(rewrite?.destination || requestUrl.pathname);
    const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : extname(pathname) ? pathname : pathname + '/index.html'));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.avif': 'image/avif', '.webp': 'image/webp' })[extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(5000);
  const requests = [];
  let revoked = false;
  let previousConsent = false;
  let grantsUnavailable = false;
  const id = '11111111-1111-4111-8111-111111111111';
  let consentClient = { id, name: 'Test host' };
  let consentScope = 'email';
  try {
    await page.route('**/_supabase.json', (route) => route.fulfill({ json: { url: 'https://xswebtvkueusdaeboizp.supabase.co', anonKey: 'public' } }));
    await page.route('https://xswebtvkueusdaeboizp.supabase.co/**', async (route) => {
      const request = route.request(), path = new URL(request.url()).pathname;
      requests.push({ path, method: request.method(), body: request.postDataJSON() });
      let body = {};
      if (path.endsWith('/settings')) body = { external: { apple: true, google: true } };
      if (path.endsWith('/verify') || path.endsWith('/token')) body = { access_token: 'secret-page-token', user: { id, email: 'a@example.com', is_anonymous: false } };
      if (path.endsWith('/user')) body = { id, email: 'a@example.com', is_anonymous: false };
      if (path.endsWith(`/authorizations/${id}`)) body = { authorization_id: id, client: consentClient, scope: consentScope, redirect_uri: 'https://host.example/callback' };
      if (previousConsent && path.endsWith(`/authorizations/${id}`)) body = { redirect_url: 'https://host.example/callback?code=previous-consent' };
      if (path.endsWith('/consent')) body = { redirect_url: 'https://host.example/callback?code=one-use' };
      if (path.endsWith('/grants')) {
        if (grantsUnavailable) { await route.fulfill({ status: 503, json: { error: 'Unavailable' } }); return; }
        if (request.method() === 'DELETE') revoked = true;
        body = revoked ? [] : [{ client: { id, name: 'Test host' }, scopes: ['email'] }];
      }
      await route.fulfill({ json: body });
    });
    await page.route('https://host.example/**', (route) => route.fulfill({ body: '<h1>Returned to host</h1>', contentType: 'text/html' }));
    await page.goto(`${origin}/connect?authorization_id=${id}`);
    await page.waitForURL(`${origin}/account?authorization_id=${id}`);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Continue with Apple', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('.connect-provider img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
      assert.equal(await page.locator('.connect-provider img').evaluateAll((images) => images.every((image) => image.naturalWidth > 0)), true);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.locator('.connect-provider').evaluateAll((buttons) => buttons.every((button) => button.querySelector('img').getBoundingClientRect().right <= button.querySelector('span').getBoundingClientRect().left)), true, 'Provider logos must not overlap large text');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.getByLabel('Email address', { exact: true }).fill('a@example.com');
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await page.getByRole('heading', { name: 'Create your account', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    await page.getByLabel('Email code', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.getByRole('heading', { name: 'Connect your assistant' }).waitFor();
    await page.getByText(/Requesting app: Test host/).waitFor();
    assert.equal(await page.locator('#connect-client-note').isVisible(), true);
    assert.equal(requests.find((r) => r.path.endsWith('/otp')).body.create_user, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]).includes('secret-page-token')), false);
    await page.getByRole('button', { name: 'Allow connection', exact: true }).click();
    await page.getByText('Confirm that you are 13 or older and accept the privacy policy to connect.', { exact: true }).waitFor();
    assert.equal(requests.some((r) => r.path.endsWith('/consent')), false);
    await page.getByLabel('I am 13 or older', { exact: true }).check();
    await page.getByLabel('I accept the Privacy Policy', { exact: true }).check();
    await page.getByRole('button', { name: 'Allow connection', exact: true }).click();
    await page.waitForURL('https://host.example/callback?code=one-use');
    assert.equal(requests.find((r) => r.path.endsWith('/consent')).body.action, 'approve');
    await page.goto(`${origin}/account`);
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).fill('a@example.com');
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    assert.equal(requests.filter((r) => r.path.endsWith('/otp')).at(-1).body.create_user, false);
    await page.getByLabel('Email code', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.getByRole('heading', { name: 'Your account', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Your account', exact: true }).getByText('a@example.com', { exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('link', { name: 'Get the app', exact: true }).getAttribute('href'), 'https://apps.apple.com/app/id6738364276');
    assert.equal(await page.getByRole('link', { name: 'ChatGPT', exact: true }).getAttribute('href'), '/assistants#chatgpt');
    assert.equal(await page.getByRole('link', { name: 'Claude', exact: true }).getAttribute('href'), '/assistants#claude');
    assert.equal(await page.locator('#connect-setup a[href^="mailto:"]').count(), 0);
    await page.locator('.connect-app-art img').evaluate((image) => image.decode());
    assert.ok(await page.locator('.connect-app-art img').evaluate((image) => image.naturalWidth > 0));
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.VIRWAVE_ACCOUNT_SCREENSHOT) await page.screenshot({ path: process.env.VIRWAVE_ACCOUNT_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.getByRole('button', { name: 'Disconnect Test host', exact: true }).click();
    await page.getByRole('button', { name: 'Keep connection', exact: true }).click();
    assert.equal(requests.some((r) => r.method === 'DELETE'), false);
    await page.getByRole('button', { name: 'Disconnect Test host', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm disconnect', exact: true }).click();
    await page.getByText('No assistants connected yet.', { exact: true }).waitFor();
    assert.equal(revoked, true);
    assert.deepEqual(requests.filter((r) => r.method === 'DELETE').map((r) => r.path), ['/auth/v1/user/oauth/grants']);
    assert.equal(await page.getByRole('heading', { name: 'Your account', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    assert.equal(await page.locator('#connect-account-email').textContent(), '');
    // A callback started before the rename must still validate at /connect,
    // exchange once, and then show the canonical account home.
    const legacyReturn = await page.evaluate(async () => {
      const { startProviderLogin } = await import('/assets/js/connect-auth.mjs');
      const url = await startProviderLogin('https://xswebtvkueusdaeboizp.supabase.co', 'google', `${location.origin}/connect`, null);
      return new URL(url).searchParams.get('redirect_to');
    });
    grantsUnavailable = true;
    await page.goto(`${legacyReturn}&code=synthetic-provider-code`);
    await page.getByRole('heading', { name: 'Your account', exact: true }).waitFor();
    assert.equal(page.url(), `${origin}/account`);
    await page.getByText('Connections could not be loaded. Try again, or sign in again.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Get the app', exact: true }).isVisible(), true);
    grantsUnavailable = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByText('No assistants connected yet.', { exact: true }).waitFor();
    const exchanges = requests.filter((r) => r.path.endsWith('/token')).length;
    await page.goto(`${legacyReturn}&code=synthetic-provider-code`);
    await page.getByText('Restart sign-in from this page. The return could not be verified.', { exact: true }).waitFor();
    assert.equal(requests.filter((r) => r.path.endsWith('/token')).length, exchanges);
    // Supabase cannot recover an expired provider state, so it falls back to
    // Site URL. Route that exact error to sign-in without trusting its payload.
    await page.goto(`${origin}/?error=invalid_request&error_code=bad_oauth_state&error_description=untrusted-copy&code=never-exchange`);
    await page.getByRole('heading', { name: 'Sign-in timed out', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Sign in or create an account', exact: true }).isVisible(), false);
    assert.equal(await page.locator('#connect-title').evaluate((element) => element === document.activeElement), true);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    if (process.env.VIRWAVE_TIMEOUT_SCREENSHOT) await page.screenshot({ path: process.env.VIRWAVE_TIMEOUT_SCREENSHOT, fullPage: true });
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Sign-in recovery', exact: true }).isVisible(), false);
    assert.equal(page.url(), `${origin}/account`);
    assert.equal(await page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled(), true);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('virwave-connect-pkce')), null);
    assert.equal(requests.filter((r) => r.path.endsWith('/token')).length, exchanges);
    assert.equal(await page.getByText('untrusted-copy', { exact: true }).count(), 0);
    // A valid callback that outlived this tab's PKCE attempt uses the same recovery screen.
    const expiredReturn = await page.evaluate(async () => {
      const { startProviderLogin } = await import('/assets/js/connect-auth.mjs');
      const url = await startProviderLogin('https://xswebtvkueusdaeboizp.supabase.co', 'apple', `${location.origin}/account`, 'abcdefghijklmnopqrstuvwxyz012345');
      const pending = JSON.parse(sessionStorage.getItem('virwave-connect-pkce'));
      pending.createdAt = Date.now() - 601_000;
      sessionStorage.setItem('virwave-connect-pkce', JSON.stringify(pending));
      return new URL(url).searchParams.get('redirect_to');
    });
    await page.goto(`${expiredReturn}&code=never-exchange`);
    await page.getByRole('heading', { name: 'Sign-in timed out', exact: true }).waitFor();
    assert.equal(page.url(), `${origin}/account`);
    assert.equal(requests.filter((r) => r.path.endsWith('/token')).length, exchanges);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('virwave-connect-pkce')), null);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('button', { name: 'Continue with Apple', exact: true }).waitFor();
    // Brand identity follows only exact reviewed IDs, and every scope stays visible.
    for (const [clientId, expectedName] of [['0836fb27-5e44-4ae9-820f-17ccab4c8bc9', 'Claude'], ['e8accebc-63e7-418d-b5c4-3ccc0854b7e8', 'ChatGPT'], [id, null]]) {
      consentClient = { id: clientId, name: expectedName ? 'Untrusted supplied name' : 'ChatGPT' };
      consentScope = expectedName ? 'email offline_access' : 'email offline_access unknown:<img> profile openid';
      await page.goto(`${origin}/account?authorization_id=${id}`);
      await page.getByLabel('Email address', { exact: true }).fill('a@example.com');
      await page.getByRole('button', { name: 'Send code', exact: true }).click();
      await page.getByLabel('Email code', { exact: true }).fill('123456');
      await page.getByRole('button', { name: 'Verify code', exact: true }).click();
      await page.getByRole('heading', { name: expectedName ? `Connect to ${expectedName}` : 'Connect your assistant', exact: true }).waitFor();
      assert.equal(await page.locator('#connect-title').evaluate((element) => element === document.activeElement), true);
      const brand = page.locator('#connect-consent-brand > img');
      await brand.evaluate((image) => image.decode());
      assert.equal(await brand.getAttribute('src'), '/assets/icon.png');
      assert.equal(await page.locator('#connect-assistant-brand').isVisible(), Boolean(expectedName));
      if (expectedName) {
        const providerIcon = page.locator('#connect-assistant-icon');
        assert.equal(await providerIcon.getAttribute('src'), expectedName === 'Claude' ? '/assets/img/partners/claude-icon.svg' : '/assets/img/partners/chatgpt-icon.webp');
        await providerIcon.evaluate((image) => image.decode());
        assert.ok(await providerIcon.evaluate((image) => image.naturalWidth > 0));
      } else assert.equal(await page.locator('#connect-assistant-icon').getAttribute('src'), null);
      assert.ok(await brand.evaluate((image) => image.naturalWidth > 0 && image.getBoundingClientRect().top >= 0 && image.getBoundingClientRect().bottom < innerHeight), 'Logo stays visible when consent heading receives focus');
      assert.equal(await page.getByLabel('I am 13 or older', { exact: true }).isChecked(), false);
      assert.equal(await page.getByLabel('I accept the Privacy Policy', { exact: true }).isChecked(), false);
      await page.getByText('See your email address to identify your VirWave account', { exact: true }).waitFor();
      await page.getByText('Keep VirWave connected without asking you to sign in each time', { exact: true }).waitFor();
      await page.getByText(/This connection can also view account details and change profile information/).waitFor();
      await page.getByText(/Connecting does not sign you up for research or marketing, or change your existing choices/).waitFor();
      assert.equal(await page.locator('#connect-consent details').count(), 0, 'Residual access warning cannot be hidden in a disclosure');
      assert.equal(await page.locator('#connect-consent').innerText().then((text) => /Supabase|MCP practice|offline_access/.test(text)), false);
      if (!expectedName) {
        await page.getByText(/Requesting app: ChatGPT/).waitFor();
        await page.getByText('Additional permission requested: unknown:<img>. Only continue if you understand this access.', { exact: true }).waitFor();
        assert.equal(await page.locator('#connect-scopes img').count(), 0, 'Unknown scope is escaped as text');
        assert.equal(await page.locator('#connect-scopes li').count(), 5);
      }
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Consent fits viewport');
      }
      await page.setViewportSize({ width: 320, height: 900 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Consent supports 200% text at 320px');
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      if (expectedName === 'ChatGPT' && process.env.VIRWAVE_CONSENT_DESKTOP_SCREENSHOT) {
        await page.setViewportSize({ width: 1440, height: 1200 });
        await page.screenshot({ path: process.env.VIRWAVE_CONSENT_DESKTOP_SCREENSHOT, fullPage: true });
      }
      if (expectedName && process.env.VIRWAVE_CONSENT_SCREENSHOT) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: process.env.VIRWAVE_CONSENT_SCREENSHOT.replace('.png', `-${expectedName.toLowerCase()}.png`), fullPage: true });
      }
      const beforeDecisions = requests.filter((request) => request.path.endsWith('/consent')).length;
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.waitForURL('https://host.example/callback?code=one-use');
      assert.equal(requests.filter((request) => request.path.endsWith('/consent')).length, beforeDecisions + 1);
      assert.equal(requests.filter((request) => request.path.endsWith('/consent')).at(-1).body.action, 'deny');
    }
    previousConsent = true;
    await page.goto(`${origin}/account?authorization_id=${id}`);
    await page.getByLabel('Email address', { exact: true }).fill('a@example.com');
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    await page.getByLabel('Email code', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.getByRole('heading', { name: 'Connect your assistant' }).waitFor();
    await page.getByText('No permission details were provided. Read the account access information below before continuing.', { exact: true }).waitFor();
    await page.getByLabel('I am 13 or older', { exact: true }).check();
    await page.getByLabel('I accept the Privacy Policy', { exact: true }).check();
    await page.getByRole('button', { name: 'Allow connection', exact: true }).click();
    await page.waitForURL('https://host.example/callback?code=previous-consent');
    await page.goto(`${origin}/`);
    await page.getByRole('button', { name: 'Toggle navigation menu', exact: true }).click();
    await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'Account', exact: true }).click();
    await page.waitForURL(`${origin}/account`);
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    await page.goto(`${origin}/assistants#chatgpt`);
    await page.getByRole('heading', { name: 'VirWave + ChatGPT', exact: true }).waitFor();
    assert.equal(await page.locator('script').count(), 0, 'Guide must not load account authentication runtime');
    assert.equal(await page.locator('a[href^="mailto:"]').count(), 0, 'Assistant setup must not send users to email');
    assert.equal(await page.getByRole('link', { name: 'Open ChatGPT apps', exact: true }).getAttribute('href'), 'https://chatgpt.com/plugins');
    await page.getByText('https://virwave.com/mcp', { exact: true }).waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Guide must fit narrow screens');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Guide must support large text');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.getByRole('link', { name: 'Claude', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#claude');
    if (process.env.VIRWAVE_GUIDE_SCREENSHOT) await page.screenshot({ path: process.env.VIRWAVE_GUIDE_SCREENSHOT, fullPage: true });
    await page.goto(`${origin}/`);
    const appLink = page.getByRole('link', { name: 'Get the app', exact: true });
    assert.equal(await appLink.getAttribute('href'), 'https://apps.apple.com/app/id6738364276');
  } finally { await browser.close(); await new Promise((done) => server.close(done)); }
});
