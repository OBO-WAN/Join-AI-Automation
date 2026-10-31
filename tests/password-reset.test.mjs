import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });

function resetPage(reply = () => response({})) {
  const html = read('forgot_password.html');
  const elements = new Map();
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    const attributes = new Map(), classes = new Set(['d-none']);
    elements.set(id, { value: '', textContent: '', disabled: false, readOnly: false,
      attributes, focused: false,
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: (key) => attributes.delete(key),
      classList: { contains: (name) => classes.has(name),
        toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } },
      focus() { this.focused = true; },
    });
  }
  const storage = () => {
    const values = new Map();
    return { values, getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key) };
  };
  const requests = [];
  const context = vm.createContext({
    URL, URLSearchParams, console, sessionStorage: storage(), localStorage: storage(),
    document: { getElementById: (id) => elements.get(id), querySelectorAll: () => [] },
    location: { href: 'https://join.test/forgot_password.html' }, addEventListener() {},
    fetch: async (url, options) => {
      const request = { url: new URL(url), options, body: JSON.parse(options.body) };
      requests.push(request);
      return reply(request);
    },
  });
  context.window = context;
  for (const [, path] of html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) {
    vm.runInContext(read(path), context, { filename: path });
  }
  const input = elements.get('password_reset_email');
  input.value = 'user@example.test';
  return { context, input, requests, elements,
    status: elements.get('password_reset_status'),
    button: elements.get('password_reset_button'),
    submit: () => context.handlePasswordReset({ preventDefault() {} }),
  };
}

test('welcome and login expose a working recovery link without JavaScript navigation', () => {
  for (const page of ['index.html', 'login.html']) {
    assert.match(read(page), /href="forgot_password.html">Forgot your password\?<\/a>/);
    assert.match(read(page), /password_reset.css\?v=20261031-reset1/);
  }
  const html = read('forgot_password.html');
  assert.match(html, /href="login.html" aria-label="Back to log in"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /onsubmit="handlePasswordReset\(event\); return false;"/);
  assert.doesNotMatch(html, /type="password"/);
});

test('the reset request uses the existing project and sends only the trimmed email and reset action', async () => {
  const page = resetPage();
  page.input.value = ' user@example.test ';
  assert.equal(await page.submit(), true);
  const request = page.requests[0];
  assert.equal(request.url.origin, 'https://identitytoolkit.googleapis.com');
  assert.equal(request.url.pathname, '/v1/accounts:sendOobCode');
  assert.equal(request.url.searchParams.get('key'), page.context.FIREBASE_WEB_CONFIG.apiKey);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(request.body, { requestType: 'PASSWORD_RESET', email: 'user@example.test' });
});

for (const invalid of ['', ' ', 'bad email', 'user@', 'user@example']) {
  test(`invalid email ${JSON.stringify(invalid)} sends no request and identifies the input`, async () => {
    const page = resetPage();
    page.input.value = invalid;
    assert.equal(await page.submit(), false);
    assert.equal(page.requests.length, 0);
    assert.equal(page.input.attributes.get('aria-invalid'), 'true');
    assert.equal(page.input.focused, true);
    assert.match(page.status.textContent, /valid email/i);
  });
}

test('existing, unknown and disabled account results use the same confirmation', async () => {
  const messages = [];
  for (const reply of [() => response({ email: 'user@example.test' }),
    () => response({}),
    () => response({ error: { message: 'EMAIL_NOT_FOUND' } }, 400),
    () => response({ error: { message: 'USER_DISABLED' } }, 400)]) {
    const page = resetPage(reply);
    assert.equal(await page.submit(), true);
    assert.equal(page.button.disabled, true);
    messages.push(page.status.textContent);
    assert.equal(page.status.classList.contains('d-none'), false);
  }
  assert.equal(new Set(messages).size, 1);
  assert.match(messages[0], /^If an account exists/);
});

test('resetting a password request neither signs in nor changes an existing session', async () => {
  const page = resetPage();
  page.context.storeFirebaseAuth({ localId: 'uid-demo', idToken: 'demo-token',
    refreshToken: 'demo-refresh', email: 'user@example.test' }, true);
  const before = JSON.stringify([...page.context.localStorage.values]);
  assert.equal(await page.submit(), true);
  assert.equal(JSON.stringify([...page.context.localStorage.values]), before);
  assert.equal(page.context.getStoredFirebaseAuth().localId, 'uid-demo');
  assert.equal(page.requests.length, 1);
});

for (const failure of ['offline', 'invalid-json', 429, 500, 'TOO_MANY_ATTEMPTS_TRY_LATER', 'INVALID_EMAIL', 'OPERATION_NOT_ALLOWED']) {
  test(`reset failure ${failure} remains visible and permits an explicit retry`, async () => {
    const page = resetPage(() => {
      if (failure === 'offline') throw new Error('Network unavailable');
      if (failure === 'invalid-json') return new Response('Not JSON', { status: 200 });
      return response({ error: { message: String(failure) } }, typeof failure === 'number' ? failure : 400);
    });
    assert.equal(await page.submit(), false);
    assert.equal(page.button.disabled, false);
    assert.equal(page.input.readOnly, false);
    assert.equal(page.status.classList.contains('d-none'), false);
    assert.doesNotMatch(page.status.textContent, /^If an account exists/);
    assert.equal(page.requests.length, 1);
    assert.equal(await page.submit(), false);
    assert.equal(page.requests.length, 2);
  });
}

test('duplicate clicks while sending and after completion cannot issue another reset email', async () => {
  let resolve;
  const gate = new Promise((done) => { resolve = done; });
  const page = resetPage(() => gate);
  const pending = page.submit();
  assert.equal(page.input.readOnly, true);
  assert.equal(page.button.disabled, true);
  assert.equal(await page.submit(), false);
  resolve(response({}));
  assert.equal(await pending, true);
  assert.equal(await page.submit(), false);
  assert.equal(page.requests.length, 1);
});

test('editing the email after completion clears feedback and permits the new request', async () => {
  const page = resetPage();
  await page.submit();
  page.input.value = 'second@example.test';
  page.context.clearPasswordResetFeedback();
  assert.equal(page.button.disabled, false);
  assert.equal(page.status.textContent, '');
  await page.submit();
  assert.equal(page.requests[1].body.email, 'second@example.test');
});
