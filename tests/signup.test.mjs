import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const signupHtml = await readFile(new URL('sign_up.html', root), 'utf8');
const scriptSources = await Promise.all(
  [...signupHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(async ([, src]) => {
    const url = new URL(src, root);
    url.search = '';
    return { path: url.pathname, source: await readFile(url, 'utf8') };
  }),
);

function makeElement(value = '') {
  const classes = new Set();
  return {
    value,
    checked: false,
    disabled: false,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name);
        else classes.delete(name);
        return force;
      },
    },
  };
}

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const isAuth = ({ url }) => url.hostname === 'identitytoolkit.googleapis.com';
const isWrite = ({ method }) => method === 'PUT';

function defaultResponse(request) {
  if (isAuth(request)) {
    return jsonResponse({
      localId: 'test-uid',
      email: request.body.email,
      idToken: 'test-id-token',
      refreshToken: 'test-refresh-token',
      expiresIn: '3600',
    });
  }
  if (isWrite(request)) return jsonResponse(request.body);
  if (request.url.pathname.replace(/\/+/g, '/') === '/randomColorsJson.json') {
    return jsonResponse({ palette: ['#FF7A00', '#9327FF'] });
  }
  throw new Error(`Unexpected mocked request: ${request.method} ${request.url.pathname}`);
}

function signupHarness({ fields = {}, privacy = true, respond = defaultResponse } = {}) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  const inputs = {
    name_sign_up: 'Anna Lee',
    'email_sign-up': 'anna@example.invalid',
    password_sign_up: 'Test password 42',
    confirm_sign_up: 'Test password 42',
    ...fields,
  };
  for (const [id, value] of Object.entries(inputs)) element(id).value = value;
  element('checkbox').checked = privacy;

  const requests = [];
  const timers = [];
  const errors = [];
  const context = vm.createContext({
    URL,
    URLSearchParams,
    sessionStorage: makeStorage(),
    localStorage: makeStorage(),
    location: { href: 'https://join.test/sign_up.html' },
    document: { getElementById: element },
    console: { error: (...args) => errors.push(args), warn() {} },
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    // Every request is intercepted here; these tests never contact Firebase.
    fetch: async (input, options = {}) => {
      const url = new URL(input);
      assert.ok([
        'identitytoolkit.googleapis.com',
        'join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app',
      ].includes(url.hostname), `Unexpected host in mocked fetch: ${url.hostname}`);
      const request = {
        url,
        method: options.method ?? 'GET',
        headers: new Headers(options.headers),
        body: options.body === undefined ? undefined : JSON.parse(options.body),
      };
      requests.push(request);
      return respond(request);
    },
  });
  context.window = context;
  for (const { path, source } of scriptSources) {
    vm.runInContext(source, context, { filename: path });
  }
  return {
    context,
    element,
    requests,
    timers,
    errors,
    succeeded: () => element('popup_overlay_sign_up').classList.contains('d-flex'),
  };
}

test('valid signup persists an authenticated, password-free profile before reporting success', async () => {
  const app = signupHarness();
  await app.context.handleSignUp();

  assert.equal(app.requests.length, 2);
  const [auth, profile] = app.requests;
  assert.equal(auth.url.pathname, '/v1/accounts:signUp');
  assert.equal(profile.method, 'PUT');
  assert.equal(profile.url.pathname.replace(/\/+/g, '/'), '/user/test-uid.json');
  assert.equal(profile.url.searchParams.get('auth'), 'test-id-token');
  assert.equal(profile.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(Object.keys(profile.body).sort(), [
    'email', 'firstname', 'initials', 'lastname', 'randomColor',
  ]);
  assert.equal(profile.body.firstname, 'Anna');
  assert.equal(profile.body.lastname, 'Lee');
  assert.equal(profile.body.initials, 'AL');
  assert.equal(profile.body.email, 'anna@example.invalid');
  assert.match(profile.body.randomColor, /^#[0-9A-F]{6}$/);
  assert.equal(app.succeeded(), true);
  assert.equal(app.context.sessionStorage.getItem('joinFirebaseAuth'), null);
  assert.ok(app.timers.some(({ delay }) => delay === 500));
});

for (const confirmation of ['', '   ', 'Different password 42']) {
  test(`invalid password confirmation ${JSON.stringify(confirmation)} prevents account creation`, async () => {
    const app = signupHarness({ fields: { confirm_sign_up: confirmation } });
    await app.context.enableOrDisableSignUpButton();
    assert.equal(app.element('sign_up_button').disabled, true);
    await app.context.handleSignUp();
    assert.equal(app.requests.length, 0);
    assert.equal(app.succeeded(), false);
  });
}

test('a matching confirmation enables signup after the empty field is completed', async () => {
  const app = signupHarness({ fields: { confirm_sign_up: '' } });
  await app.context.enableOrDisableSignUpButton();
  assert.equal(app.element('sign_up_button').disabled, true);
  app.element('confirm_sign_up').value = app.element('password_sign_up').value;
  await app.context.enableOrDisableSignUpButton();
  assert.equal(app.element('sign_up_button').disabled, false);
  await app.context.handleSignUp();
  assert.equal(app.succeeded(), true);
});

for (const [name, options] of [
  ['short password', { fields: { password_sign_up: 'short', confirm_sign_up: 'short' } }],
  ['invalid email', { fields: { 'email_sign-up': 'invalid-email' } }],
  ['invalid name', { fields: { name_sign_up: 'Anna' } }],
  ['unchecked privacy consent', { privacy: false }],
]) {
  test(`${name} prevents account creation`, async () => {
    const app = signupHarness(options);
    await app.context.handleSignUp();
    assert.equal(app.requests.length, 0);
    assert.equal(app.succeeded(), false);
  });
}

test('signup sends the exact password, including surrounding whitespace, to Firebase Auth', async () => {
  const password = '  Test password 42  ';
  const app = signupHarness({
    fields: { password_sign_up: password, confirm_sign_up: password },
  });
  await app.context.handleSignUp();
  assert.equal(app.requests[0].body.password, password);
  assert.equal(app.succeeded(), true);
});

test('confirmation must match the surrounding password whitespace exactly', async () => {
  const app = signupHarness({ fields: { password_sign_up: ' Test password 42 ' } });
  await app.context.handleSignUp();
  assert.equal(app.requests.length, 0);
  assert.equal(app.succeeded(), false);
});

for (const name of ['Anna  Lee', 'Anna\tLee']) {
  test(`accepted name ${JSON.stringify(name)} produces a complete profile`, async () => {
    const app = signupHarness({ fields: { name_sign_up: name } });
    await app.context.handleSignUp();
    assert.equal(app.requests.length, 2);
    assert.equal(app.requests[1].body.firstname, 'Anna');
    assert.equal(app.requests[1].body.lastname, 'Lee');
    assert.equal(app.requests[1].body.initials, 'AL');
    assert.equal(app.succeeded(), true);
  });
}

test('profile preparation failure is handled before an Auth account is created', async () => {
  const app = signupHarness();
  app.context.createUserProfileDataFromParts = async () => {
    throw new Error('Profile preparation failed');
  };
  await app.context.handleSignUp();
  assert.equal(app.requests.length, 0);
  assert.equal(app.succeeded(), false);
  assert.equal(app.timers.length, 0);
});

for (const code of ['EMAIL_EXISTS', 'OPERATION_NOT_ALLOWED']) {
  test(`Firebase Auth failure ${code} never reports signup success`, async () => {
    const app = signupHarness({ respond: () => jsonResponse({ error: { message: code } }, 400) });
    await app.context.handleSignUp();
    assert.equal(app.requests.length, 1);
    assert.equal(app.succeeded(), false);
    assert.equal(app.timers.length, 0);
    if (code === 'EMAIL_EXISTS') {
      assert.equal(app.element('error_message_email').classList.contains('d-flex'), true);
    }
  });
}

test('Firebase Auth network failure never starts a profile write', async () => {
  const app = signupHarness({ respond: () => { throw new TypeError('Offline'); } });
  await app.context.handleSignUp();
  assert.equal(app.requests.length, 1);
  assert.equal(app.succeeded(), false);
  assert.equal(app.timers.length, 0);
});

for (const status of [401, 403, 500]) {
  test(`profile HTTP ${status} never reports success or clears the partial account session`, async () => {
    const app = signupHarness({
      respond: (request) => isWrite(request)
        ? jsonResponse({ error: 'Profile write failed' }, status)
        : defaultResponse(request),
    });
    await app.context.handleSignUp();
    assert.equal(app.requests.length, 2);
    assert.equal(app.succeeded(), false);
    assert.equal(app.timers.length, 0);
    assert.notEqual(app.context.sessionStorage.getItem('joinFirebaseAuth'), null);
  });
}

for (const failure of ['network', 'invalid JSON']) {
  test(`profile ${failure} failure never reports signup success`, async () => {
    const app = signupHarness({
      respond: (request) => {
        if (!isWrite(request)) return defaultResponse(request);
        if (failure === 'network') throw new TypeError('Offline');
        return new Response('Invalid JSON', { status: 200 });
      },
    });
    await app.context.handleSignUp();
    assert.equal(app.requests.length, 2);
    assert.equal(app.succeeded(), false);
    assert.equal(app.timers.length, 0);
    assert.notEqual(app.context.sessionStorage.getItem('joinFirebaseAuth'), null);
  });
}

test('updateData rejects a non-JSON HTTP error with its status', async () => {
  const app = signupHarness({ respond: () => new Response('Forbidden', { status: 403 }) });
  await assert.rejects(app.context.updateData('/user/test-uid', {}), /Firebase PUT failed: 403/);
});

test('updateData preserves the original network error for its caller', async () => {
  const offline = new TypeError('Offline');
  const app = signupHarness({ respond: () => { throw offline; } });
  await assert.rejects(app.context.updateData('/user/test-uid', {}), (error) => error === offline);
});

for (const value of [{ firstname: 'Anna' }, ['#FF7A00'], 0]) {
  test(`updateData returns an acknowledged ${Array.isArray(value) ? 'array' : typeof value} unchanged`, async () => {
    const app = signupHarness();
    assert.deepEqual(await app.context.updateData('/test', value), value);
  });
}

test('random color selection still returns a color after an acknowledged update', async () => {
  const app = signupHarness();
  assert.match(await app.context.getRandomColor(), /^#[0-9A-F]{6}$/);
  const write = app.requests.find(isWrite);
  assert.equal(write.body.length, 1);
});

test('random color selection returns no color when its update is denied', async () => {
  const app = signupHarness({
    respond: (request) => isWrite(request)
      ? jsonResponse({ error: 'Permission denied' }, 401)
      : defaultResponse(request),
  });
  assert.equal(await app.context.getRandomColor(), null);
  assert.equal(app.requests.filter(isWrite).length, 1);
});

test('returning a color to the palette handles a rejected update without an unhandled rejection', async () => {
  const app = signupHarness({
    respond: (request) => isWrite(request)
      ? jsonResponse({ error: 'Permission denied' }, 401)
      : defaultResponse(request),
  });
  await app.context.addColorToExistingArray('palette', '#00BEE8');
  assert.equal(app.requests.filter(isWrite).length, 1);
  assert.ok(app.errors.some(([message]) => message === 'Error adding color'));
});
