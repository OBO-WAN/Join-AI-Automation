import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  app, authCreates, authLogins, deferred, fillLogin, fillSignup, firebase, profile, puts, reply, signIn
} from './helpers/profile-harness.mjs';

for (const failure of [401, 403, 500, 'network', 'invalid JSON']) {
  test(`login profile ${failure} is a visible read error, never a missing profile or invalid password`, async () => {
    let failing = true;
    const server = firebase({ initialProfile: profile(), hook: (request) => {
      if (request.url.hostname.includes('firebasedatabase') && request.method === 'GET' && failing) {
        if (failure === 'network') throw new TypeError('Offline');
        if (failure === 'invalid JSON') return new Response('Invalid JSON');
        return reply({ error: 'Permission denied' }, failure);
      }
    } });
    const page = app('login.html', server);
    fillLogin(page);
    assert.equal(await page.context.handleFirebaseLogin(), false);
    assert.equal(page.context.location.href, 'https://join.test/login.html');
    assert.equal(page.el('login_status').classList.contains('d-none'), false);
    assert.match(page.el('login_status').textContent, /signed in.*profile could not be loaded/i);
    assert.equal(page.el('retry_profile_button').classList.contains('d-none'), false);
    assert.equal(page.el('error_message_log_in').classList.contains('d-flex'), false);
    failing = false;
    assert.equal(await page.context.retryJoinLoginProfile(), true);
    assert.equal(authLogins(server).length, 1);
    assert.equal(page.context.location.href, 'summary.html');
    assert.equal(puts(server).length, 0);
  });
}

for (const invalid of [false, [], { initials: 'AL' }]) {
  test(`malformed existing profile ${JSON.stringify(invalid)} is never treated as absent or overwritten`, async () => {
    const server = firebase({ initialProfile: invalid });
    const page = app('sign_up.html', server);
    signIn(page);
    await page.context.initializeSignUpPage();
    assert.match(page.el('signup_status').textContent, /existing profile needs review/i);
    assert.equal(page.el('sign_up_button').textContent, 'Retry profile check');
    await page.context.handleSignUp();
    assert.equal(puts(server).length, 0);
    assert.deepEqual(server.db.get('uid-a'), invalid);
  });
}

test('remembered account restores its profile using the Auth UID instead of a stale UI UID', async () => {
  const server = firebase({ initialProfile: profile() });
  const page = app('summary.html', server);
  signIn(page, 'uid-a', true);
  page.session.setItem('loggedInUserId', 'stale-uid');
  page.session.setItem('firstName', 'Old');
  const user = await page.context.loadUserData();
  assert.equal(user.profileState, 'ready');
  assert.equal(page.session.getItem('loggedInUserId'), 'uid-a');
  assert.equal(page.session.getItem('firstName'), 'Anna');
  assert.ok(server.requests.every(({ url }) => url.pathname === '/user/uid-a.json'));
});

for (const state of ['guest', 'missing', 'error']) {
  test(`Summary ${state} keeps public statistics working and labels profile state explicitly`, async () => {
    const server = firebase({ hook: (request) => state === 'error' ? reply({ error: 'Unavailable' }, 500) : undefined });
    const page = app('summary.html', server);
    if (state !== 'guest') signIn(page);
    let stats = 0;
    page.context.updateTaskData = () => stats++;
    await page.context.initializeSummaryData();
    assert.equal(stats, 1);
    assert.equal(page.names[0].textContent, { guest: 'guest', missing: 'Profile incomplete', error: 'Profile unavailable' }[state]);
    if (state === 'guest') assert.equal(server.requests.length, 0);
    else assert.equal(page.el('summary_profile_status').classList.contains('d-none'), false);
    assert.equal(puts(server).length, 0);
  });
}

test('profile names are rendered as text on Summary', async () => {
  const marker = '<em data-audit="probe">Anna</em>';
  const server = firebase({ initialProfile: profile(marker, 'Lee') });
  const page = app('summary.html', server);
  signIn(page);
  page.context.updateTaskData = () => {};
  await page.context.initializeSummaryData();
  assert.equal(page.names[0].textContent, `${marker} Lee`);
  assert.equal(page.names[0].innerHTML, '');
});

test('an untouched signup page does not immediately show input errors', async () => {
  const server = firebase({ registered: false });
  const page = app('sign_up.html', server);
  await page.context.initializeSignUpPage();
  assert.equal(page.el('email_sign-up').classList.contains('not-valide-error'), false);
  assert.equal(page.el('password_sign_up').classList.contains('not-valide-error'), false);
  assert.equal(page.el('signup_login_link').classList.contains('d-none'), true);
  assert.equal(page.el('sign_up_button').disabled, true);
  assert.equal(server.requests.length, 0);
});

test('an expired session during initial provisioning requires login instead of a second signup', async () => {
  let page;
  const server = firebase({ registered: false, hook: (request) => {
    if (request.method === 'PUT') {
      page.context.clearFirebaseAuthStorage();
      return reply({ error: 'Expired' }, 401);
    }
  } });
  page = app('sign_up.html', server);
  fillSignup(page);
  await page.context.handleSignUp();
  assert.equal(page.el('sign_up_button').textContent, 'Log in');
  await page.context.handleSignUp();
  assert.equal(page.context.location.href, 'login.html');
  assert.equal(authCreates(server).length, 1);
});

test('a malformed write acknowledgement triggers a read-only profile check', async () => {
  let malformed = true;
  const server = firebase({ registered: false, hook: (request, state) => {
    if (request.method === 'PUT' && malformed) {
      malformed = false;
      state.db.set('uid-a', request.body);
      state.commits++;
      return reply(null);
    }
  } });
  const page = app('sign_up.html', server);
  fillSignup(page);
  await page.context.handleSignUp();
  assert.equal(page.succeeded(), false);
  assert.equal(page.el('sign_up_button').textContent, 'Retry profile check');
  await page.context.handleSignUp();
  assert.equal(page.el('sign_up_button').textContent, 'Continue to summary');
  assert.equal(puts(server).length, 1);
  assert.equal(server.commits, 1);
});

test('an ambiguous Auth response can be recovered through an explicit login', async () => {
  const server = firebase({ registered: false, hook: (request, state) => {
    if (request.url.pathname.endsWith(':signUp')) {
      state.registered = true;
      throw new TypeError('Auth account created, response lost');
    }
  } });
  const signup = app('sign_up.html', server);
  fillSignup(signup);
  await signup.context.handleSignUp();
  assert.match(signup.el('signup_status').textContent, /could not be confirmed.*logging in/i);
  assert.equal(signup.el('signup_login_link').classList.contains('d-none'), false);
  assert.equal(puts(server).length, 0);
  const login = app('login.html', server);
  fillLogin(login);
  await login.context.handleFirebaseLogin();
  assert.equal(login.context.location.href, 'sign_up.html?completeProfile=1');
  assert.equal(authCreates(server).length, 1);
  assert.equal(authLogins(server).length, 1);
});

test('EMAIL_EXISTS never signs in or writes profiles implicitly', async () => {
  const server = firebase();
  const page = app('sign_up.html', server);
  fillSignup(page);
  await page.context.handleSignUp();
  assert.match(page.el('signup_status').textContent, /already exists.*log in/i);
  assert.equal(authLogins(server).length, 0);
  assert.equal(puts(server).length, 0);
  assert.equal(page.session.getItem('joinFirebaseAuth'), null);
});

test('a failed profile check is retried as a read before enabling profile creation', async () => {
  let failing = true;
  const server = firebase({ hook: (request) => request.method === 'GET' && failing
    ? reply({ error: 'Permission denied' }, 401) : undefined });
  const page = app('sign_up.html', server);
  signIn(page);
  await page.context.initializeSignUpPage();
  assert.equal(page.el('sign_up_button').textContent, 'Retry profile check');
  assert.equal(page.el('name_sign_up').disabled, true);
  failing = false;
  await page.context.handleSignUp();
  assert.equal(page.el('sign_up_button').textContent, 'Save profile');
  assert.equal(puts(server).length, 0);
});

test('a profile read from the previous account is rejected even if the account changes during body parsing', async () => {
  const body = deferred();
  const started = deferred();
  const server = firebase({ hook: (request) => {
    if (request.method === 'GET') return {
      ok: true, status: 200,
      json: async () => { started.resolve(); return body.promise; },
    };
  } });
  const page = app('sign_up.html', server);
  signIn(page);
  const pending = page.context.loadJoinUserProfile('uid-a');
  await started.promise;
  signIn(page, 'uid-b');
  body.resolve(profile('Previous', 'User'));
  await assert.rejects(pending, { code: 'PROFILE_AUTH_REQUIRED' });
});

test('a profile write acknowledgement cannot restore the previous account after a switch during body parsing', async () => {
  const body = deferred();
  const started = deferred();
  const server = firebase({ hook: (request) => {
    if (request.method === 'PUT') return {
      ok: true, status: 200,
      json: async () => { started.resolve(); return body.promise; },
    };
  } });
  const page = app('sign_up.html', server);
  signIn(page);
  await page.context.initializeSignUpPage();
  page.el('name_sign_up').value = 'Previous User';
  page.el('checkbox').checked = true;
  const pending = page.context.handleSignUp();
  await started.promise;
  signIn(page, 'uid-b');
  body.resolve(profile('Previous', 'User'));
  await pending;
  assert.equal(page.el('sign_up_button').textContent, 'Log in');
  assert.notEqual(page.session.getItem('loggedInUserId'), 'uid-a');
  assert.notEqual(page.session.getItem('firstName'), 'Previous');
  assert.notEqual(page.context.location.href, 'summary.html');
});

test('invalid credentials stay a login error and do not read a profile', async () => {
  const server = firebase({ hook: (request) => request.url.pathname.endsWith(':signInWithPassword')
    ? reply({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400) : undefined });
  const page = app('login.html', server);
  fillLogin(page);
  assert.equal(await page.context.handleFirebaseLogin(), false);
  assert.equal(page.el('error_message_log_in').classList.contains('d-flex'), true);
  assert.equal(server.requests.length, 1);
  assert.equal(page.el('retry_profile_button').classList.contains('d-none'), true);
});

test('concurrent login clicks submit credentials once', async () => {
  const gate = deferred();
  const started = deferred();
  const server = firebase({ initialProfile: profile(), hook: async (request) => {
    if (request.url.pathname.endsWith(':signInWithPassword')) { started.resolve(); await gate.promise; }
  } });
  const page = app('login.html', server);
  fillLogin(page);
  const pending = page.context.handleFirebaseLogin();
  await started.promise;
  assert.equal(page.el('login_button').disabled, true);
  assert.equal(await page.context.handleFirebaseLogin(), false);
  assert.equal(authLogins(server).length, 1);
  gate.resolve();
  await pending;
  assert.equal(page.context.location.href, 'summary.html');
});

test('expired profile tokens refresh through Firebase before the private read', async () => {
  const server = firebase({ initialProfile: profile() });
  const page = app('summary.html', server);
  page.context.storeFirebaseAuth({ localId: 'uid-a', email: 'anna@example.invalid', idToken: 'expired', refreshToken: 'refresh-a', expiresIn: -1 });
  const user = await page.context.loadUserData();
  assert.equal(user.firstname, 'Anna');
  assert.equal(server.requests[0].url.hostname, 'securetoken.googleapis.com');
  assert.equal(server.requests[1].url.searchParams.get('auth'), 'token-a');
});

test('profile provisioning writes only profile fields and uses the authenticated email', async () => {
  const server = firebase();
  const page = app('sign_up.html', server);
  signIn(page);
  await page.context.provisionJoinUserProfile('uid-a', {
    ...profile(), email: 'different@example.invalid', role: 'editor', password: 'Do not store',
  });
  assert.deepEqual(Object.keys(server.db.get('uid-a')).sort(), ['email', 'firstname', 'initials', 'lastname', 'randomColor']);
  assert.equal(server.db.get('uid-a').email, 'anna@example.invalid');
});

test('late Summary failures do not replace a newer successful profile display', async () => {
  const gate = deferred();
  const started = deferred();
  let first = true;
  const server = firebase({ initialProfile: profile(), hook: async (request) => {
    if (request.method === 'GET' && first) {
      first = false;
      started.resolve();
      await gate.promise;
      return reply({ error: 'Unavailable' }, 500);
    }
  } });
  const page = app('summary.html', server);
  signIn(page);
  page.context.updateTaskData = () => {};
  const pending = page.context.initializeSummaryData();
  await started.promise;
  await page.context.initializeSummaryData();
  assert.equal(page.names[0].textContent, 'Anna Lee');
  gate.resolve();
  await pending;
  assert.equal(page.names[0].textContent, 'Anna Lee');
  assert.equal(page.el('summary_profile_status').classList.contains('d-none'), true);
});

test('the public board still loads tasks without Auth or private profile access', async () => {
  const server = firebase({ hook: (request) => {
    if (request.url.pathname === '/contacts.json') return reply({ error: 'Permission denied' }, 401);
    if (request.url.pathname === '/tasks.json') return reply({ task1: { title: 'Public task', status: 'triage' } });
    throw new Error('The public board attempted an unexpected request');
  } });
  const page = app('board.html', server);
  page.context.renderCurrentTasks = () => {};
  page.context.refreshOpenTaskOverlay = () => {};
  page.context.showCurrentBoard = () => {};
  await page.context.init();
  assert.equal(vm.runInContext('tasks[0].title', page.context), 'Public task');
  assert.ok(server.requests.every(({ method, url }) => method === 'GET' && !url.pathname.startsWith('/user/')));
});
