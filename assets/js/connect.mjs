import { createAccountClient, safeReturnUrl, startProviderLogin, consumeProviderReturn, clearProviderLogin } from './connect-auth.mjs';

const el = (name) => document.getElementById(`connect-${name}`);
const arrivalUrl = new URL(location.href);
let authorizationId = arrivalUrl.searchParams.get('authorization_id');
let approvedReturn = null;
let client, configuration, email, createUser = false, busy = false, resendAt = 0;
// Remove provider codes immediately, including rejected/error callbacks.
if (arrivalUrl.searchParams.has('code') || arrivalUrl.searchParams.has('error') || arrivalUrl.searchParams.has('error_code')) history.replaceState(null, '', location.pathname);
function status(message, error = false) { el('status').textContent = message; el('status').setAttribute('role', error ? 'alert' : 'status'); }
function show(name, title) {
  for (const section of ['login', 'code', 'consent', 'manage', 'expired']) el(section).hidden = section !== name;
  el('title').textContent = title;
  document.body.classList.toggle('connect-consent-view', name === 'consent');
  el('consent-brand').hidden = name !== 'consent';
  el('title').focus({ preventScroll: name === 'consent' });
  // Bring the card's brand and heading into view together after code entry.
  if (name === 'consent') el('main').scrollIntoView({ block: 'start', behavior: 'instant' });
}
function showLogin() {
  show('login', createUser ? 'Create your account' : 'Welcome back');
  el('intro').hidden = false;
  el('mode-prompt').textContent = createUser ? 'Already have an account?' : 'New to VirWave?';
  el('mode').textContent = createUser ? 'Sign in' : 'Create an account';
  status('');
}
function showExpired() {
  clearProviderLogin();
  authorizationId = null; approvedReturn = null; createUser = false;
  client?.forget();
  history.replaceState(null, '', '/account');
  el('intro').hidden = true;
  show('expired', 'Sign-in timed out');
  status('');
}
el('restart').addEventListener('click', showLogin);
el('mode').addEventListener('click', () => { createUser = !createUser; showLogin(); });
async function action(work) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  status('Please wait…');
  try { await work(); }
  catch (error) {
    if (error.code === 'provider_login_expired') showExpired();
    else status(error.message || 'Unable to continue. Please try again.', true);
  }
  finally { busy = false; document.querySelectorAll('button').forEach((button) => { button.disabled = false; }); }
}
function returnToHost(value) {
  const target = safeReturnUrl(value);
  client.forget();
  location.assign(target.href);
}
// Display names are bound to reviewed public client IDs, never a supplied name.
const assistantNames = new Map([
  ['0836fb27-5e44-4ae9-820f-17ccab4c8bc9', 'Claude'],
  ['e8accebc-63e7-418d-b5c4-3ccc0854b7e8', 'ChatGPT'],
]);
const permissionDescriptions = new Map([
  ['email', 'See your email address to identify your VirWave account'],
  ['offline_access', 'Keep VirWave connected without asking you to sign in each time'],
  ['openid', 'Identify your signed-in VirWave account'],
  ['profile', 'See your basic profile information'],
]);
function describeConnection(details) {
  const assistant = assistantNames.get(details.client?.id);
  el('client-note').hidden = Boolean(assistant);
  el('client-note').textContent = details.client?.id
    ? `Requesting app: ${details.client.name || 'Unnamed app'}. We haven’t identified this connection as Claude or ChatGPT. Continue only if you recognise it.`
    : 'Your assistant’s name and requested permissions were not provided for this existing connection. Continue only if you recognise the request you started.';
  const scopes = typeof details.scope === 'string' ? details.scope.trim().split(/\s+/).filter(Boolean) : [];
  el('scopes').replaceChildren();
  for (const scope of [...new Set(scopes)]) {
    const item = document.createElement('li');
    // Preserve unrecognised permissions visibly; never infer a lesser permission.
    item.textContent = permissionDescriptions.get(scope) || `Additional permission requested: ${scope}. Only continue if you understand this access.`;
    el('scopes').append(item);
  }
  if (!scopes.length) {
    const item = document.createElement('li');
    item.textContent = 'No permission details were provided. Read the account access information below before continuing.';
    el('scopes').append(item);
  }
  return assistant ? `Connect to ${assistant}` : 'Connect your assistant';
}
async function signedIn(user) {
  el('intro').hidden = true;
  if (authorizationId) {
    const details = await client.authorization(authorizationId);
    // Supabase consent is not the app's age/privacy declaration. An existing
    // native grant still needs this page's explicit declarations before return.
    approvedReturn = details.redirect_url || null;
    if (!approvedReturn && (!details.client?.id || details.authorization_id !== authorizationId)) throw new Error('Restart this connection from your assistant.');
    el('user').textContent = user.email;
    el('age').checked = false; el('privacy').checked = false;
    show('consent', describeConnection(details));
    status('');
  } else {
    el('account-email').textContent = user.email;
    show('manage', 'Your account');
    status('');
    await loadGrants();
  }
}
async function loadGrants() {
  el('grants').replaceChildren();
  el('grants-retry').hidden = true;
  el('grants-status').textContent = 'Checking connections…';
  let grants;
  try {
    grants = await client.grants();
    if (!Array.isArray(grants)) throw new Error('Invalid connection list.');
  } catch {
    // The account remains useful when this optional list is unavailable.
    el('grants-status').textContent = 'Connections could not be loaded. Try again, or sign in again.';
    el('grants-retry').hidden = false;
    return;
  }
  for (const grant of grants) {
    const item = document.createElement('li'), name = document.createElement('span'), remove = document.createElement('button');
    name.textContent = grant.client.name || 'Connected assistant';
    remove.textContent = `Disconnect ${name.textContent}`;
    remove.type = 'button';
    remove.addEventListener('click', () => {
      const confirmation = document.createElement('div'), prompt = document.createElement('p'), confirm = document.createElement('button'), cancel = document.createElement('button');
      confirmation.className = 'connect-disconnect';
      prompt.textContent = `Disconnect ${name.textContent}? Your account and saved sessions will stay.`;
      confirm.type = cancel.type = 'button';
      confirm.textContent = 'Confirm disconnect'; cancel.textContent = 'Keep connection';
      confirm.addEventListener('click', () => action(async () => {
        await client.revoke(grant.client.id); await loadGrants(); status('Assistant disconnected.'); el('connections-title').focus();
      }));
      cancel.addEventListener('click', () => { confirmation.remove(); remove.hidden = false; remove.focus(); });
      confirmation.append(prompt, confirm, cancel); item.append(confirmation); remove.hidden = true; cancel.focus();
    });
    item.append(name, remove); el('grants').append(item);
  }
  el('grants-status').textContent = grants.length ? '' : 'No assistants connected yet.';
}
el('grants-retry').addEventListener('click', () => action(async () => { await loadGrants(); status(''); }));
el('email-form').addEventListener('submit', (event) => { event.preventDefault(); void action(async () => {
  email = el('email').value.trim().toLowerCase();
  await client.sendCode(email, createUser); resendAt = Date.now() + 60_000;
  el('email-label').textContent = email;
  el('intro').hidden = true;
  show('code', 'Check your email'); status(''); el('otp').focus();
}); });
el('code-form').addEventListener('submit', (event) => { event.preventDefault(); void action(async () => {
  const code = el('otp').value; el('otp').value = '';
  await signedIn(await client.verifyCode(email, code));
}); });
el('resend').addEventListener('click', () => action(async () => {
  if (Date.now() < resendAt) throw new Error('Wait one minute before requesting another code.');
  await client.sendCode(email, createUser); resendAt = Date.now() + 60_000; status('A new code is on its way.');
}));
el('change').addEventListener('click', () => { client.forget(); el('otp').value = ''; showLogin(); });
for (const [name, approved] of [['allow', true], ['deny', false]]) el(name).addEventListener('click', () => action(async () => {
  if (approved) await client.acceptTerms(el('age').checked, el('privacy').checked);
  if (approvedReturn) {
    const target = safeReturnUrl(approvedReturn);
    if (!approved) { target.searchParams.delete('code'); target.searchParams.set('error', 'access_denied'); }
    returnToHost(target.href); return;
  }
  const result = await client.decide(authorizationId, approved);
  returnToHost(result.redirect_url);
}));
el('signout').addEventListener('click', () => {
  client.forget(); el('grants').replaceChildren(); el('account-email').textContent = ''; el('setup').open = false;
  el('email').value = ''; el('otp').value = ''; createUser = false; showLogin(); status('Signed out.');
});
for (const provider of ['apple', 'google']) el(provider).addEventListener('click', () => action(async () => {
  const url = await startProviderLogin(configuration.url, provider, `${location.origin}${location.pathname}`, authorizationId);
  location.assign(url.href);
}));

void action(async () => {
  const response = await fetch('/_supabase.json', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Account connection is unavailable. Please try again later.');
  configuration = await response.json();
  client = createAccountClient(configuration);
  const settings = await client.settings();
  for (const provider of ['apple', 'google']) {
    if (settings.external?.[provider] === true) { el(provider).hidden = false; el('providers').hidden = false; }
  }
  if (arrivalUrl.searchParams.get('error_code') === 'bad_oauth_state') {
    showExpired();
    return;
  }
  if (arrivalUrl.searchParams.has('code') || arrivalUrl.searchParams.has('error')) {
    const pending = consumeProviderReturn(arrivalUrl);
    authorizationId = pending.authorizationId;
    // Validate legacy /connect callbacks before changing their path. This keeps
    // provider attempts started before the /account migration valid and one-use.
    history.replaceState(null, '', `/account${authorizationId ? `?authorization_id=${encodeURIComponent(authorizationId)}` : ''}`);
    if (pending.error) throw new Error('Sign-in was not completed. Try again, or use an email code.');
    await signedIn(await client.exchangeCode(pending.code, pending.verifier));
    return;
  }
  status('');
});
