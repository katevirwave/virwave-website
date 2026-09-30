// A small native Auth API adapter, matching this site's existing fetch-based
// Supabase convention. Supabase owns codes, accounts, OAuth, and consent.
// Account tokens live only in this page's memory, never localStorage or URLs.
export function safeReturnUrl(value) {
  const url = new URL(value);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('This return address is not supported. Restart the connection from your assistant.');
  }
  return url;
}
const uuid = (value) => {
  if (typeof value !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)) throw new Error('Invalid connection. Restart from your assistant.');
  return value;
};
// Native Auth uses a random opaque string here; only client IDs are UUIDs.
const authorization = (value) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(value)) throw new Error('Invalid connection. Restart from your assistant.');
  return value;
};
const emailAddress = (value) => {
  const email = String(value).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
};
const providerKey = 'virwave-connect-pkce';
export function clearProviderLogin(storage = sessionStorage) { storage.removeItem(providerKey); }
export async function startProviderLogin(authUrl, provider, returnAddress, authorizationId, storage = sessionStorage, cryptoApi = crypto) {
  if (!['apple', 'google'].includes(provider)) throw new Error('This sign-in provider is not supported.');
  if (authorizationId) authorization(authorizationId);
  const callback = safeReturnUrl(returnAddress);
  callback.search = ''; callback.hash = '';
  const verifier = Array.from(cryptoApi.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const state = cryptoApi.randomUUID();
  const digest = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  storage.setItem(providerKey, JSON.stringify({ verifier, state, authorizationId, callback: callback.href, createdAt: Date.now() }));
  callback.searchParams.set('login_state', state);
  const url = new URL(safeReturnUrl(authUrl).href.replace(/\/$/, '') + '/auth/v1/authorize');
  url.search = new URLSearchParams({ provider, redirect_to: callback.href, code_challenge: challenge, code_challenge_method: 's256' }).toString();
  return url;
}
export function consumeProviderReturn(callback, storage = sessionStorage) {
  let pending;
  try { pending = JSON.parse(storage.getItem(providerKey)); } catch { /* Invalid or absent browser state requires a fresh sign-in. */ }
  clearProviderLogin(storage);
  const url = new URL(callback);
  const address = new URL(url); address.search = ''; address.hash = '';
  if (!pending || pending.callback !== address.href || pending.state !== url.searchParams.get('login_state') ||
      (!url.searchParams.get('code') && !url.searchParams.get('error')) || !Number.isFinite(pending.createdAt) || Date.now() < pending.createdAt) {
    throw new Error('Restart sign-in from this page. The return could not be verified.');
  }
  if (Date.now() - pending.createdAt > 600_000) {
    throw Object.assign(new Error('Restart sign-in from this page. The sign-in attempt has expired.'), { code: 'provider_login_expired' });
  }
  if (url.searchParams.has('error')) return { authorizationId: pending.authorizationId, error: true, code: null };
  return { ...pending, code: url.searchParams.get('code') };
}
export function createAccountClient(config, send = fetch) {
  const base = safeReturnUrl(config.url).href.replace(/\/$/, '');
  if (!config.anonKey) throw new Error('Account connection is not configured.');
  let accessToken = null;
  async function request(path, method = 'GET', body, authenticated = true, service = 'auth/v1') {
    if (authenticated && !accessToken) throw new Error('Sign in to continue.');
    let response;
    try {
      response = await send(`${base}/${service}${path}`, { method, headers: { apikey: config.anonKey, 'content-type': 'application/json',
        ...(authenticated ? { authorization: `Bearer ${accessToken}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store' });
    } catch { throw new Error('Connection failed. Check your connection, then try again.'); }
    if (!response.ok) {
      if (response.status === 401) accessToken = null;
      throw new Error(response.status === 429 ? 'Too many attempts. Wait a minute, then try again.' : 'This request could not be completed. Check your code, or sign in again.');
    }
    return response.status === 204 ? null : response.json();
  }
  async function acceptSession(session) {
    if (!session || typeof session.access_token !== 'string' || !session.user?.id || session.user.is_anonymous !== false) throw new Error('A verified VirWave account is required.');
    accessToken = session.access_token;
    try {
      const user = await request('/user');
      if (user.id !== session.user.id || user.is_anonymous !== false) throw new Error('A verified VirWave account is required.');
      return user;
    } catch (error) { accessToken = null; throw error; }
  }
  return {
    async acceptTerms(age, privacy) {
      if (age !== true || privacy !== true) throw new Error('Confirm that you are 13 or older and accept the privacy policy to connect.');
      return request('/rpc/mcp_accept_account_terms', 'POST', {}, true, 'rest/v1');
    },
    async sendCode(email, createUser = false) { return request('/otp', 'POST', { email: emailAddress(email), create_user: createUser === true }, false); },
    async verifyCode(email, code) {
      if (!/^\d{6,8}$/.test(code)) throw new Error('Enter the code from your email.');
      return acceptSession(await request('/verify', 'POST', { email: emailAddress(email), token: code, type: 'email' }, false));
    },
    async exchangeCode(code, verifier) {
      if (typeof code !== 'string' || !code || !/^[\da-f]{64}$/.test(verifier)) throw new Error('Restart sign-in from this page.');
      return acceptSession(await request('/token?grant_type=pkce', 'POST', { auth_code: code, code_verifier: verifier }, false));
    },
    user: () => request('/user'),
    authorization: async (id) => request(`/oauth/authorizations/${authorization(id)}`),
    async decide(id, approved) { return request(`/oauth/authorizations/${authorization(id)}/consent`, 'POST', { action: approved ? 'approve' : 'deny' }); },
    grants: () => request('/user/oauth/grants'),
    revoke: async (id) => request(`/user/oauth/grants?client_id=${uuid(id)}`, 'DELETE'),
    settings: () => request('/settings', 'GET', undefined, false),
    forget: () => { accessToken = null; },
  };
}
