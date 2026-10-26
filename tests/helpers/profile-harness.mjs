import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
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

export {
  app, authCreates, authLogins, clone, deferred, fillLogin, fillSignup, firebase, profile, puts, reply, signIn
};
