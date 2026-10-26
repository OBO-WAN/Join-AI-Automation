import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  app, assertCleared, authData, database, deferred,
  identityKeys, key, pages, refreshData, reply,
  seed, storage
} from './helpers/auth-harness.mjs';

for (const [file, { html }] of pages) {
  if (!html.includes('logOut()')) continue;
  for (const remember of [false, true]) test(`${file}: logout clears ${remember ? 'remembered' : 'tab'} credentials before navigation`, () => {
    const page = app(file);
    seed(page, { remember });
    let destination;
    Object.defineProperty(page.context.location, 'href', {
      get: () => destination,
      set: (value) => { assertCleared(page); destination = value; },
    });
    // Run the actual inline click handler, including links with return false.
    const handler = html.match(/onclick="([^"]*logOut\(\)[^"]*)"/)[1];
    vm.runInContext(`(function () { ${handler} }).call(null)`, page.context);
    assertCleared(page);
    assert.equal(page.context.location.href, 'login.html');
    assert.equal(page.requests.length, 0);
  });
}

for (const remember of [false, true]) test(`parallel token consumers share one refresh and retain ${remember ? 'local' : 'session'} persistence`, async () => {
  const gate = deferred();
  const page = app('login.html', { respond: () => gate.promise });
  seed(page, { remember, expired: true });
  const pending = [page.context.getFirebaseIdToken(), page.context.getFirebaseIdToken(), page.context.getFirebaseIdToken()];
  const count = page.requests.length;
  gate.resolve(reply(refreshData()));
  assert.deepEqual(await Promise.all(pending), ['fresh-uid-a', 'fresh-uid-a', 'fresh-uid-a']);
  assert.equal(count, 1);
  const saved = JSON.parse((remember ? page.local : page.session).getItem(key));
  assert.equal(saved.refreshToken, 'rotated-uid-a');
  assert.equal(saved.email, 'uid-a@example.invalid');
  assert.ok(saved.expiresAt > Date.now() + 3_500_000);
  assert.equal((remember ? page.session : page.local).getItem(key), null);
  assert.equal(page.session.getItem('firstName'), 'previous-user');
  assert.equal(await page.context.getFirebaseIdToken(), 'fresh-uid-a');
  assert.equal(page.requests.length, 1);
});

test('a fresh ID token is reused without a refresh request', async () => {
  const page = app(); seed(page);
  assert.equal(await page.context.getFirebaseIdToken(), 'token-uid-a');
  assert.equal(page.requests.length, 0);
});

for (const remember of [false, true]) test(`late refresh after ${remember ? 'remembered' : 'tab'} logout cannot resurrect credentials or send a write`, async () => {
  const gate = deferred();
  const page = app('login.html', { respond: () => gate.promise });
  seed(page, { remember, expired: true });
  const pending = page.context.authenticatedFirebaseFetch(`${database}/tasks/task.json`, { method: 'PATCH', body: '{}' });
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  page.context.firebaseAuthLogout();
  gate.resolve(reply(refreshData()));
  await rejected;
  assertCleared(page);
  assert.equal(page.requests.length, 1);
});

for (const failure of [false, true]) test(`late refresh ${failure ? 'failure' : 'success'} preserves a newer account`, async () => {
  const gate = deferred();
  const page = app('login.html', { respond: () => gate.promise });
  seed(page, { expired: true });
  const pending = page.context.getFirebaseIdToken();
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  seed(page, { uid: 'uid-b', remember: true });
  gate.resolve(failure ? reply({ error: { message: 'TOKEN_EXPIRED' } }, 400) : reply(refreshData()));
  await rejected;
  assert.equal(page.context.getStoredFirebaseAuth().localId, 'uid-b');
  assert.equal(page.context.getStoredFirebaseAuth().idToken, 'token-uid-b');
  assert.equal(page.session.getItem('loggedInUserId'), 'uid-b');
});

test('logout and a new login to the same UID invalidate an older refresh', async () => {
  const gate = deferred();
  const page = app('login.html', { respond: () => gate.promise });
  seed(page, { expired: true });
  const pending = page.context.getFirebaseIdToken();
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  page.context.firebaseAuthLogout();
  seed(page);
  gate.resolve(reply(refreshData()));
  await rejected;
  assert.equal(page.context.getStoredFirebaseAuth().idToken, 'token-uid-a');
});

test('logout during refresh response parsing prevents session restoration', async () => {
  const body = deferred(); const started = deferred();
  const page = app('login.html', { respond: () => ({ ok: true, json: () => { started.resolve(); return body.promise; } }) });
  seed(page, { expired: true });
  const pending = page.context.getFirebaseIdToken();
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  await started.promise;
  page.context.firebaseAuthLogout();
  body.resolve(refreshData());
  await rejected;
  assertCleared(page);
});

for (const code of ['TOKEN_EXPIRED', 'USER_DISABLED', 'USER_NOT_FOUND', 'INVALID_REFRESH_TOKEN', 'MISSING_REFRESH_TOKEN']) {
  test(`${code}: rejected refresh clears tokens and UI identity without anonymous fallback`, async () => {
    const page = app('login.html', { respond: () => reply({ error: { message: code } }, 400) });
    seed(page, { remember: true, expired: true });
    await assert.rejects(page.context.authenticatedFirebaseFetch(`${database}/user/uid-a.json`), { code: 'AUTH_SESSION_EXPIRED' });
    assertCleared(page);
    assert.equal(page.requests.length, 1);
  });
}

for (const failure of ['offline', '429', '500', 'invalid-json', 'invalid-key']) test(`${failure}: transient or configuration refresh failure preserves the session for retry`, async () => {
  let first = true;
  const page = app('login.html', { respond: () => {
    if (!first) return reply(refreshData());
    first = false;
    if (failure === 'offline') throw new TypeError('Network unavailable');
    if (failure === 'invalid-json') return new Response('not json');
    if (failure === 'invalid-key') return reply({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400);
    return reply({ error: { message: 'Service unavailable' } }, Number(failure));
  } });
  seed(page, { remember: true, expired: true });
  const raw = page.local.getItem(key);
  await assert.rejects(page.context.authenticatedFirebaseFetch(`${database}/user/uid-a.json`), { code: 'AUTH_REFRESH_FAILED' });
  assert.equal(page.local.getItem(key), raw);
  assert.equal(page.session.getItem('firstName'), 'previous-user');
  assert.equal(page.requests.length, 1);
  assert.equal(await page.context.getFirebaseIdToken(), 'fresh-uid-a');
  assert.equal(page.requests.length, 2);
});

for (const invalid of [{}, refreshData('uid-b'), refreshData('uid-a', { id_token: '' }), refreshData('uid-a', { refresh_token: '' }), refreshData('uid-a', { expires_in: 'NaN' })]) {
  test(`invalid refresh payload ${JSON.stringify(invalid)} is never persisted`, async () => {
    const page = app('login.html', { respond: () => reply(invalid) });
    seed(page, { expired: true });
    const raw = page.session.getItem(key);
    await assert.rejects(page.context.getFirebaseIdToken(), { code: 'AUTH_REFRESH_FAILED' });
    assert.equal(page.session.getItem(key), raw);
  });
}

for (const raw of ['not-json', 'null', 'false', '[]', '{}', JSON.stringify({ idToken: 'orphan' })]) test(`corrupt stored session ${raw} clears cached identity`, () => {
  const page = app(); seed(page);
  page.session.setItem(key, raw);
  assert.equal(page.context.getStoredFirebaseAuth(), null);
  assertCleared(page);
});

for (const endpoint of ['firebaseSignIn', 'firebaseSignUp']) test(`${endpoint}: logout while authentication is pending prevents a late login`, async () => {
  const gate = deferred();
  const page = app('login.html', { respond: () => gate.promise });
  seed(page);
  const pending = page.context[endpoint]('uid-a@example.invalid', 'test password', true);
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  page.context.firebaseAuthLogout();
  gate.resolve(reply(authData()));
  await rejected;
  assertCleared(page);
});

test('the later of two login attempts wins even when the older response arrives last', async () => {
  const gates = [deferred(), deferred()]; let count = 0;
  const page = app('login.html', { respond: () => gates[count++].promise });
  const older = page.context.firebaseSignIn('a@example.invalid', 'test password');
  const rejected = assert.rejects(older, { code: 'AUTH_SESSION_CHANGED' });
  const newer = page.context.firebaseSignIn('b@example.invalid', 'test password', true);
  gates[1].resolve(reply(authData('uid-b')));
  await newer;
  gates[0].resolve(reply(authData('uid-a')));
  await rejected;
  assert.equal(page.context.getStoredFirebaseAuth().localId, 'uid-b');
  assert.notEqual(page.local.getItem(key), null);
});

test('starting a new login invalidates an older refresh while keeping its response from interrupting the login', async () => {
  const refresh = deferred(); const login = deferred();
  const page = app('login.html', { respond: ({ url }) => url.hostname === 'securetoken.googleapis.com' ? refresh.promise : login.promise });
  seed(page, { expired: true });
  const pendingRefresh = page.context.getFirebaseIdToken();
  const rejected = assert.rejects(pendingRefresh, { code: 'AUTH_SESSION_CHANGED' });
  const pendingLogin = page.context.firebaseSignIn('b@example.invalid', 'test password', true);
  refresh.resolve(reply({ error: { message: 'TOKEN_EXPIRED' } }, 400));
  await rejected;
  login.resolve(reply(authData('uid-b')));
  assert.equal((await pendingLogin).localId, 'uid-b');
  assert.equal(page.context.getStoredFirebaseAuth().localId, 'uid-b');
});

test('login recovers immediately from corrupt stored credentials', async () => {
  const page = app();
  page.session.setItem(key, 'not-json');
  assert.equal((await page.context.firebaseSignIn('a@example.invalid', 'test password')).localId, 'uid-a');
});

test('late invalid-credential responses after guest login are reported as cancelled requests', async () => {
  const gate = deferred();
  const page = app('login.html', { respond: () => gate.promise });
  const pending = page.context.firebaseSignIn('a@example.invalid', 'wrong password');
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  page.context.guestLogin();
  gate.resolve(reply({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400));
  await rejected;
  assert.equal(page.context.getStoredFirebaseAuth(), null);
});

test('guest login clears Firebase auth and prevents an in-flight sign-in from taking over', async () => {
  const gate = deferred();
  const page = app('login.html', { respond: () => gate.promise });
  seed(page, { remember: true });
  const pending = page.context.firebaseSignIn('a@example.invalid', 'test password');
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  page.context.guestLogin();
  gate.resolve(reply(authData()));
  await rejected;
  assert.equal(page.context.getStoredFirebaseAuth(), null);
  assert.equal(page.session.getItem('firstName'), null);
  assert.equal(page.local.getItem('isGuest'), 'true');
  assert.equal(page.context.location.href, 'summary.html');
});

test('a remembered session reload still returns its token without moving it to sessionStorage', async () => {
  const local = storage(); const first = app('login.html', { local });
  seed(first, { remember: true });
  const reloaded = app('summary.html', { local });
  assert.equal(await reloaded.context.getFirebaseIdToken(), 'token-uid-a');
  assert.equal(reloaded.session.getItem(key), null);
  assert.equal(reloaded.requests.length, 0);
});

test('logout in another remembered tab invalidates a pending refresh even before its storage event', async () => {
  const local = storage(); const gate = deferred();
  const first = app('login.html', { local, respond: () => gate.promise });
  seed(first, { remember: true, expired: true });
  const second = app('help.html', { local });
  const pending = first.context.getFirebaseIdToken();
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  second.context.logOut();
  gate.resolve(reply(refreshData()));
  await rejected;
  first.emit('storage', { storageArea: local, key, newValue: null });
  assertCleared(first);
});

test('a storage event clears stale remembered UI without signing out a separate tab session', () => {
  const local = storage(); const remembered = app('summary.html', { local });
  seed(remembered, { remember: true });
  local.removeItem(key);
  local.removeItem('isGuest');
  remembered.emit('storage', { storageArea: local, key, newValue: null });
  assertCleared(remembered);
  const separate = app('board.html', { local });
  seed(separate, { uid: 'uid-b' });
  separate.emit('storage', { storageArea: local, key, newValue: null });
  assert.equal(separate.context.getStoredFirebaseAuth().localId, 'uid-b');
  assert.equal(separate.session.getItem('firstName'), 'previous-user');
});

test('a remembered token refresh in another tab does not erase cached names for the same UID', () => {
  const page = app('summary.html');
  seed(page, { remember: true });
  const oldValue = page.local.getItem(key);
  const refreshed = { ...JSON.parse(oldValue), idToken: 'other-tab-fresh-token' };
  page.local.setItem(key, JSON.stringify(refreshed));
  page.emit('storage', { storageArea: page.local, key, oldValue, newValue: JSON.stringify(refreshed) });
  assert.equal(page.session.getItem('firstName'), 'previous-user');
  assert.equal(page.context.getStoredFirebaseAuth().idToken, 'other-tab-fresh-token');
});

test('a reload without Auth removes stale UI identity while preserving guest mode', () => {
  const local = storage(); const session = storage();
  for (const name of identityKeys) session.setItem(name, 'stale');
  session.setItem('isUser', 'true');
  local.setItem('isGuest', 'true');
  app('summary.html', { local, session });
  for (const name of identityKeys) assert.equal(session.getItem(name), null);
  assert.equal(session.getItem('isUser'), 'false');
  assert.equal(local.getItem('isGuest'), 'true');
});

test('a refreshed session with a different UID clears stale identity at page load', () => {
  const page = app(); seed(page, { remember: true });
  page.session.setItem('loggedInUserId', 'another-uid');
  app('summary.html', { local: page.local, session: page.session });
  assert.equal(page.session.getItem('firstName'), null);
  assert.equal(page.context.getStoredFirebaseAuth().localId, 'uid-a');
});

test('applying a stale login identity after logout cannot repopulate UI flags', () => {
  const page = app(); const session = seed(page);
  page.context.firebaseAuthLogout();
  assert.throws(() => page.context.applyJoinAuthIdentity(session), { code: 'AUTH_SESSION_CHANGED' });
  assertCleared(page);
});

test('a late profile response from the previous login to the same UID cannot repopulate cached names', async () => {
  const body = deferred(); const started = deferred();
  const page = app('summary.html', { respond: () => ({ ok: true, json: () => { started.resolve(); return body.promise; } }) });
  seed(page);
  const pending = page.context.hydrateAuthenticatedUserProfile(page.context.getStoredFirebaseAuth());
  const rejected = assert.rejects(pending);
  await started.promise;
  page.context.firebaseAuthLogout();
  page.context.storeFirebaseAuth(authData());
  body.resolve({ firstname: 'Previous', lastname: 'User', initials: 'PU' });
  await rejected;
  assert.equal(page.session.getItem('firstName'), null);
});

test('the shared fetch helper keeps anonymous public reads anonymous', async () => {
  const page = app();
  await page.context.authenticatedFirebaseFetch(`${database}/tasks.json`);
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].url.searchParams.has('auth'), false);
});

test('logout after token resolution but before an authenticated fetch blocks the request', async () => {
  const page = app(); seed(page);
  const pending = page.context.authenticatedFirebaseFetch(`${database}/tasks/task.json`, { method: 'PATCH' });
  const rejected = assert.rejects(pending, { code: 'AUTH_SESSION_CHANGED' });
  page.context.firebaseAuthLogout();
  await rejected;
  assert.equal(page.requests.length, 0);
});

test('avatar initials require a current matching Auth session and update when its profile arrives', async () => {
  const page = app('summary.html'); seed(page);
  page.session.setItem('loggedInUserId', 'old-uid');
  page.context.setUserInitials();
  assert.equal(page.el('first_icon_initials').textContent, 'G');
  assert.equal(page.el('last_icon_initials').textContent, '');
  page.context.applyJoinAuthIdentity(page.context.getStoredFirebaseAuth());
  await page.context.hydrateAuthenticatedUserProfile(page.context.getStoredFirebaseAuth());
  assert.equal(page.el('first_icon_initials').textContent, 'A');
  assert.equal(page.el('last_icon_initials').textContent, 'L');
  page.context.firebaseAuthLogout();
  assert.equal(page.el('first_icon_initials').textContent, 'G');
  assert.equal(page.el('last_icon_initials').textContent, '');
});
