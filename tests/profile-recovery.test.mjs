import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  app, authCreates, authLogins, clone, deferred, fillLogin, fillSignup, firebase, profile, puts, reply, signIn
} from './helpers/profile-harness.mjs';

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
