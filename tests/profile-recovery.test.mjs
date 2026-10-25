import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const pages = new Map();
for (const file of ['sign_up.html', 'login.html', 'summary.html', 'board.html']) {
  const html = await readFile(new URL(file, root), 'utf8');
  const scripts = await Promise.all([...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)>/g)]
    .map(async ([, before, src, after]) => {
      const url = new URL(src, root);
      url.search = '';
      return { path: url.pathname, source: await readFile(url, 'utf8'), defer: /\bdefer\b/.test(before + after) };
    }));
  pages.set(file, { html, scripts: [...scripts.filter((s) => !s.defer), ...scripts.filter((s) => s.defer)] });
}

function storage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function element(classes = '') {
  const names = new Set(classes.split(/\s+/));
  return {
    value: '', checked: false, disabled: false, readOnly: false,
    textContent: '', innerHTML: '', style: {},
    classList: {
      add: (...items) => items.forEach((item) => names.add(item)),
      remove: (...items) => items.forEach((item) => names.delete(item)),
      contains: (item) => names.has(item),
      toggle(item, force = !names.has(item)) {
        if (force) names.add(item);
        else names.delete(item);
        return force;
      },
    },
  };
}

const profile = (firstname = 'Anna', lastname = 'Lee') => ({
  firstname, lastname, email: 'anna@example.invalid', initials: firstname[0] + lastname[0], randomColor: '#FF7A00',
});
const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const clone = (value) => JSON.parse(JSON.stringify(value));

function firebase({ registered = true, initialProfile = null, hook } = {}) {
  const db = new Map(initialProfile === null ? [] : [['uid-a', clone(initialProfile)]]);
  const requests = [];
  const server = { registered, db, requests, commits: 0, hook };
  server.respond = async (input, options = {}) => {
    const url = new URL(input);
    const body = options.body instanceof URLSearchParams ? Object.fromEntries(options.body)
      : options.body === undefined ? undefined : JSON.parse(options.body);
    const request = { url, method: options.method ?? 'GET', headers: new Headers(options.headers), body };
    requests.push(request);
    if (server.hook) {
      const response = await server.hook(request, server);
      if (response !== undefined) return response;
    }
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      if (url.pathname.endsWith(':signUp')) {
        if (server.registered) return reply({ error: { message: 'EMAIL_EXISTS' } }, 400);
        server.registered = true;
      }
      return reply({ localId: 'uid-a', email: 'anna@example.invalid', idToken: 'token-a', refreshToken: 'refresh-a', expiresIn: '3600' });
    }
    if (url.hostname === 'securetoken.googleapis.com') {
      return reply({ user_id: 'uid-a', id_token: 'token-a', refresh_token: 'refresh-a', expires_in: '3600' });
    }
    assert.equal(url.hostname, 'join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app');
    const match = url.pathname.match(/^\/user\/([^/]+)\.json$/);
    assert.ok(match, 'Only a specific user profile may be requested in these tests');
    const uid = decodeURIComponent(match[1]);
    const authorizedUid = { 'token-a': 'uid-a', 'token-b': 'uid-b' }[url.searchParams.get('auth')];
    if (uid !== authorizedUid) return reply({ error: 'Permission denied' }, 401);
    if (request.method === 'GET') return reply(db.get(uid) ?? null);
    assert.equal(request.method, 'PUT');
    if (request.headers.get('If-Match') === 'null_etag' && db.has(uid)) return reply(db.get(uid), 412);
    db.set(uid, clone(body));
    server.commits++;
    return reply(body);
  };
  return server;
}

function app(file, server, { session = storage(), local = storage(), search = '' } = {}) {
  const { html, scripts } = pages.get(file);
  const elements = new Map();
  for (const [tag] of html.matchAll(/<[a-z][^>]*\bid="[^"]+"[^>]*>/gi)) {
    const id = tag.match(/\bid="([^"]+)"/)[1];
    const el = element(tag.match(/\bclass="([^"]*)"/)?.[1]);
    el.disabled = /\bdisabled\b/.test(tag);
    elements.set(id, el);
  }
  const names = [element('name'), element('name')];
  const timers = [];
  const context = vm.createContext({
    URL, URLSearchParams, sessionStorage: session, localStorage: local,
    location: { href: `https://join.test/${file}${search}`, search },
    document: {
      getElementById: (id) => elements.get(id) ?? null,
      querySelectorAll: (selector) => selector === '.name' ? names : [],
      querySelector: () => null,
      addEventListener() {},
    },
    addEventListener() {},
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    setInterval() {},
    console: { error() {}, warn() {} },
    fetch: server.respond,
  });
  context.window = context;
  for (const { path, source } of scripts) vm.runInContext(source, context, { filename: path });
  return {
    context, session, local, names, timers,
    el: (id) => { assert.ok(elements.has(id), `Missing actual HTML element ${id}`); return elements.get(id); },
    succeeded: () => elements.get('popup_overlay_sign_up')?.classList.contains('d-flex') ?? false,
  };
}

function signIn(app, uid = 'uid-a', remember = false) {
  app.context.storeFirebaseAuth({ localId: uid, email: 'anna@example.invalid', idToken: uid === 'uid-a' ? 'token-a' : 'token-b', refreshToken: 'refresh-a' }, remember);
}

function fillSignup(app) {
  for (const [id, value] of Object.entries({
    name_sign_up: 'Anna Lee', 'email_sign-up': 'anna@example.invalid',
    password_sign_up: 'Test password 42', confirm_sign_up: 'Test password 42',
  })) app.el(id).value = value;
  app.el('checkbox').checked = true;
}

function fillLogin(app) {
  app.el('email_log_in').value = 'anna@example.invalid';
  app.el('password_log_in').value = 'Test password 42';
}

const authCreates = (server) => server.requests.filter(({ url }) => url.pathname.endsWith(':signUp'));
const authLogins = (server) => server.requests.filter(({ url }) => url.pathname.endsWith(':signInWithPassword'));
const puts = (server) => server.requests.filter(({ method }) => method === 'PUT');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('failed signup profile write can be retried without creating another Auth account', async () => {
  let denied = true;
  const server = firebase({ registered: false, hook: (request) => request.method === 'PUT' && denied
    ? reply({ error: 'Permission denied' }, 401) : undefined });
  const page = app('sign_up.html', server);
  fillSignup(page);
  await page.context.handleSignUp();
  assert.equal(page.succeeded(), false);
  assert.match(page.el('signup_status').textContent, /account exists.*profile could not be saved/i);
  assert.equal(page.el('password_sign_up').value, '');
  assert.equal(page.el('confirm_sign_up').value, '');
  assert.equal(page.el('signup_password_field').classList.contains('d-none'), true);
  assert.equal(page.el('sign_up_button').textContent, 'Save profile');
  denied = false;
  await page.context.handleSignUp();
  assert.equal(authCreates(server).length, 1);
  assert.equal(puts(server).length, 2);
  assert.equal(server.commits, 1);
  assert.equal(page.context.location.href, 'summary.html');
  assert.equal(page.session.getItem('loggedInUserId'), 'uid-a');
  assert.equal(page.session.getItem('firstName'), 'Anna');
  assert.ok([...page.session.values.values(), ...page.local.values.values()].every((value) => !value.includes('Test password 42')));
});

test('lost write response is recovered without replacing the already committed profile', async () => {
  let lost = false;
  const server = firebase({ registered: false, hook: (request, state) => {
    if (request.method === 'PUT' && !lost) {
      lost = true;
      state.db.set('uid-a', { ...request.body, existingField: 'preserve' });
      state.commits++;
      throw new TypeError('Response lost after commit');
    }
  } });
  const page = app('sign_up.html', server);
  fillSignup(page);
  await page.context.handleSignUp();
  page.el('name_sign_up').value = 'Changed Name';
  await page.context.handleSignUp();
  assert.equal(server.commits, 1);
  assert.equal(server.db.get('uid-a').existingField, 'preserve');
  assert.equal(server.db.get('uid-a').firstname, 'Anna');
  assert.equal(page.session.getItem('firstName'), 'Anna');
  assert.equal(page.context.location.href, 'summary.html');
  assert.equal(authCreates(server).length, 1);
  assert.ok(puts(server).every(({ headers }) => headers.get('If-Match') === 'null_etag'));
});

test('reload resumes the existing account and asks for profile data without storing passwords', async () => {
  let denied = true;
  const server = firebase({ registered: false, hook: (request) => request.method === 'PUT' && denied
    ? reply({ error: 'Unavailable' }, 503) : undefined });
  const first = app('sign_up.html', server);
  fillSignup(first);
  await first.context.handleSignUp();
  const reloaded = app('sign_up.html', server, { session: first.session, local: first.local });
  await reloaded.context.initializeSignUpPage();
  assert.equal(reloaded.el('email_sign-up').readOnly, true);
  assert.equal(reloaded.el('name_sign_up').value, '');
  assert.equal(reloaded.el('password_sign_up').value, '');
  assert.equal(reloaded.el('sign_up_button').disabled, true);
  reloaded.el('name_sign_up').value = 'Anna Lee';
  reloaded.el('checkbox').checked = true;
  denied = false;
  await reloaded.context.handleSignUp();
  assert.equal(authCreates(server).length, 1);
  assert.equal(reloaded.context.location.href, 'summary.html');
});

test('login with a missing profile leads to completion and then to a named Summary', async () => {
  const server = firebase();
  const login = app('login.html', server);
  fillLogin(login);
  assert.equal(await login.context.handleFirebaseLogin(), true);
  assert.equal(login.context.location.href, 'sign_up.html?completeProfile=1');
  assert.equal(puts(server).length, 0);
  const complete = app('sign_up.html', server, { session: login.session, local: login.local, search: '?completeProfile=1' });
  await complete.context.initializeSignUpPage();
  complete.el('name_sign_up').value = 'Anna Lee';
  complete.el('checkbox').checked = true;
  await complete.context.handleSignUp();
  const summary = app('summary.html', server, { session: login.session, local: login.local });
  let stats = 0;
  summary.context.updateTaskData = () => stats++;
  await summary.context.initializeSummaryData();
  assert.equal(summary.names[0].textContent, 'Anna Lee');
  assert.equal(stats, 1);
  assert.equal(authCreates(server).length, 0);
  assert.equal(authLogins(server).length, 1);
});

test('completion URL without an Auth session asks for login and never writes a profile', async () => {
  const server = firebase();
  const page = app('sign_up.html', server, { search: '?completeProfile=1' });
  await page.context.initializeSignUpPage();
  assert.equal(page.el('sign_up_button').textContent, 'Log in');
  await page.context.handleSignUp();
  assert.equal(page.context.location.href, 'login.html');
  assert.equal(server.requests.length, 0);
});

test('an existing profile is read and preserved when the signup page is opened', async () => {
  const existing = { ...profile(), customField: 'preserve' };
  const server = firebase({ initialProfile: existing });
  const page = app('sign_up.html', server);
  signIn(page);
  await page.context.initializeSignUpPage();
  assert.equal(page.el('sign_up_button').textContent, 'Continue to summary');
  await page.context.handleSignUp();
  assert.deepEqual(server.db.get('uid-a'), existing);
  assert.equal(puts(server).length, 0);
});

test('profile provisioning preserves a record created concurrently by another client', async () => {
  const server = firebase();
  const first = app('sign_up.html', server);
  const second = app('sign_up.html', server);
  signIn(first);
  signIn(second);
  const [left, right] = await Promise.all([
    first.context.provisionJoinUserProfile('uid-a', profile('First', 'User')),
    second.context.provisionJoinUserProfile('uid-a', profile('Second', 'User')),
  ]);
  assert.equal(server.commits, 1);
  assert.deepEqual(clone(left), clone(right));
  assert.deepEqual(server.db.get('uid-a'), clone(left));
});

test('profile writes require the current account and reject a different UID before sending a request', async () => {
  const server = firebase();
  const page = app('sign_up.html', server);
  await assert.rejects(page.context.provisionJoinUserProfile('uid-a', profile()), { code: 'PROFILE_AUTH_REQUIRED' });
  signIn(page);
  await assert.rejects(page.context.provisionJoinUserProfile('uid-b', profile()), { code: 'PROFILE_AUTH_REQUIRED' });
  for (const uid of [undefined, null, '', 42]) {
    await assert.rejects(page.context.loadJoinUserProfile(uid), { code: 'PROFILE_AUTH_REQUIRED' });
  }
  assert.equal(server.requests.length, 0);
});

test('switching accounts during completion requires login instead of saving into either account', async () => {
  const server = firebase();
  const page = app('sign_up.html', server);
  signIn(page);
  await page.context.initializeSignUpPage();
  page.el('name_sign_up').value = 'Anna Lee';
  page.el('checkbox').checked = true;
  signIn(page, 'uid-b');
  await page.context.handleSignUp();
  assert.equal(puts(server).length, 0);
  assert.equal(page.el('sign_up_button').textContent, 'Log in');
  assert.match(page.el('signup_status').textContent, /session.*changed|log in again/i);
});

test('duplicate signup submissions produce one account request even if validation runs while busy', async () => {
  const gate = deferred();
  const started = deferred();
  const server = firebase({ registered: false, hook: async (request) => {
    if (request.url.pathname.endsWith(':signUp')) { started.resolve(); await gate.promise; }
  } });
  const page = app('sign_up.html', server);
  fillSignup(page);
  const pending = page.context.handleSignUp();
  await started.promise;
  await page.context.enableOrDisableSignUpButton();
  assert.equal(page.el('sign_up_button').disabled, true);
  await page.context.handleSignUp();
  assert.equal(authCreates(server).length, 1);
  gate.resolve();
  await pending;
  await page.context.handleSignUp();
  assert.equal(authCreates(server).length, 1);
});

test('duplicate profile submissions produce a single write', async () => {
  const gate = deferred();
  const started = deferred();
  const server = firebase({ hook: async (request) => {
    if (request.method === 'PUT') { started.resolve(); await gate.promise; }
  } });
  const page = app('sign_up.html', server);
  signIn(page);
  await page.context.initializeSignUpPage();
  page.el('name_sign_up').value = 'Anna Lee';
  page.el('checkbox').checked = true;
  const pending = page.context.handleSignUp();
  await started.promise;
  await page.context.handleSignUp();
  assert.equal(puts(server).length, 1);
  gate.resolve();
  await pending;
});

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
