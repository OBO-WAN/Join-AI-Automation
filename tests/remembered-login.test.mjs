import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  app, authData, deferred, key, reply, storage,
} from './helpers/auth-harness.mjs';

function rememberedPage(options = {}) {
  const local = storage();
  app('login.html', { local }).context.storeFirebaseAuth(authData(), true);
  return app('login.html', { local, ...options });
}

test('the login page automatically checks for a remembered session when ready', () => {
  const page = rememberedPage();
  vm.runInContext('retryJoinLoginProfile = () => { window.resumeCount = (window.resumeCount || 0) + 1; }', page.context);
  page.emit('DOMContentLoaded');
  assert.equal(page.context.resumeCount, 1);
});

test('a remembered login resumes Summary and restores the profile without asking for credentials', async () => {
  const page = rememberedPage();
  assert.equal(await page.context.resumeRememberedLogin(), true);
  assert.equal(page.context.location.href, 'summary.html');
  assert.equal(page.session.getItem('loggedInUserId'), 'uid-a');
  assert.equal(page.session.getItem('firstName'), 'Anna');
  assert.equal(page.session.getItem(key), null);
  assert.ok(page.local.getItem(key));
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].method, 'GET');
  assert.equal(page.requests[0].url.pathname, '/user/uid-a.json');
});

for (const checked of [false, true]) {
  test(`the actual login handler stores the checkbox choice (${checked})`, async () => {
    const page = app();
    page.el('email_log_in').value = 'uid-a@example.invalid';
    page.el('password_log_in').value = 'Test password 42';
    page.el('rememberMe').checked = checked;
    assert.equal(await page.context.handleFirebaseLogin(), true);
    assert.equal(Boolean(page.local.getItem(key)), checked);
    assert.equal(Boolean(page.session.getItem(key)), !checked);
    const reopened = app('login.html', { local: page.local });
    assert.equal(await reopened.context.resumeRememberedLogin(), checked);
    assert.equal(reopened.context.location.href, checked ? 'summary.html' : 'https://join.test/login.html');
  });
}

for (const state of ['empty', 'guest', 'logged-out', 'tab-only', 'corrupt']) {
  test(`${state} does not trigger automatic login or a profile request`, async () => {
    const page = app();
    if (state === 'guest') page.context.guestLogin();
    if (state === 'logged-out') {
      page.context.storeFirebaseAuth(authData(), true);
      page.context.logOut();
    }
    if (state === 'tab-only') page.context.storeFirebaseAuth(authData(), false);
    if (state === 'corrupt') page.local.setItem(key, 'invalid JSON');
    const before = page.context.location.href;
    assert.equal(await page.context.resumeRememberedLogin(), false);
    assert.equal(page.context.location.href, before);
    assert.equal(page.requests.length, 0);
  });
}

test('an expired remembered token refreshes before reading the profile and stays remembered', async () => {
  const page = rememberedPage();
  page.context.storeFirebaseAuth(authData('uid-a', { expiresIn: -1 }), true);
  assert.equal(await page.context.resumeRememberedLogin(), true);
  assert.equal(page.context.location.href, 'summary.html');
  assert.equal(page.requests.length, 2);
  assert.equal(page.requests[0].url.hostname, 'securetoken.googleapis.com');
  assert.equal(page.requests[1].url.searchParams.get('auth'), 'fresh-uid-a');
  assert.equal(JSON.parse(page.local.getItem(key)).refreshToken, 'rotated-uid-a');
  assert.equal(page.session.getItem(key), null);
});

test('an invalid refresh token stays on login with visible feedback and clears remembered credentials', async () => {
  const page = rememberedPage({ respond: () => reply({ error: { message: 'INVALID_REFRESH_TOKEN' } }, 400) });
  page.context.storeFirebaseAuth(authData('uid-a', { expiresIn: -1 }), true);
  assert.equal(await page.context.resumeRememberedLogin(), false);
  assert.equal(page.context.location.href, 'https://join.test/login.html');
  assert.equal(page.local.getItem(key), null);
  assert.match(page.el('login_status').textContent, /log in again/i);
  assert.equal(page.el('login_status').classList.contains('d-none'), false);
  assert.equal(page.el('login_button').disabled, false);
});

test('a missing profile resumes the existing profile-completion flow', async () => {
  const page = rememberedPage({ respond: () => reply(null) });
  assert.equal(await page.context.resumeRememberedLogin(), true);
  assert.equal(page.context.location.href, 'sign_up.html?completeProfile=1');
  assert.ok(page.local.getItem(key));
});

test('a failed profile read stays on login and allows retry without a password or another sign-in', async () => {
  let failing = true;
  const page = rememberedPage({ respond: () => failing
    ? reply({ error: 'Unavailable' }, 500)
    : reply({ firstname: 'Anna', lastname: 'Lee', initials: 'AL' }) });
  assert.equal(await page.context.resumeRememberedLogin(), false);
  assert.equal(page.context.location.href, 'https://join.test/login.html');
  assert.match(page.el('login_status').textContent, /profile could not be loaded/i);
  assert.equal(page.el('retry_profile_button').classList.contains('d-none'), false);
  assert.ok(page.local.getItem(key));
  failing = false;
  assert.equal(await page.context.retryJoinLoginProfile(), true);
  assert.equal(page.context.location.href, 'summary.html');
  assert.ok(page.requests.every(({ method }) => method === 'GET'));
});

test('Guest login during a pending resume prevents late profile restoration and redirects', async () => {
  const gate = deferred();
  const page = rememberedPage({ respond: () => gate.promise });
  const pending = page.context.resumeRememberedLogin();
  page.context.guestLogin();
  gate.resolve(reply({ firstname: 'Anna', lastname: 'Lee', initials: 'AL' }));
  assert.equal(await pending, false);
  assert.equal(page.context.location.href, 'summary.html');
  assert.equal(page.context.getStoredFirebaseAuth(), null);
  assert.equal(page.local.getItem('isGuest'), 'true');
  assert.equal(page.session.getItem('firstName'), null);
});

test('duplicate resume attempts share the existing login busy guard', async () => {
  const gate = deferred();
  const page = rememberedPage({ respond: () => gate.promise });
  const first = page.context.resumeRememberedLogin();
  assert.equal(await page.context.resumeRememberedLogin(), false);
  gate.resolve(reply({ firstname: 'Anna', lastname: 'Lee', initials: 'AL' }));
  assert.equal(await first, true);
  assert.equal(page.requests.length, 1);
});
