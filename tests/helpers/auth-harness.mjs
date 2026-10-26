import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const pages = new Map();
for (const file of (await readdir(root)).filter((name) => name.endsWith('.html'))) {
  const html = await readFile(new URL(file, root), 'utf8');
  const scripts = await Promise.all([...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)>/g)]
    .map(async ([, before, src, after]) => {
      const url = new URL(src, root);
      url.search = '';
      return { source: await readFile(url, 'utf8'), path: url.pathname, defer: /\bdefer\b/.test(before + after) };
    }));
  pages.set(file, { html, scripts: [...scripts.filter((s) => !s.defer), ...scripts.filter((s) => s.defer)] });
}

const key = 'joinFirebaseAuth';
const database = 'https://join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app';
const identityKeys = ['loggedInUserId', 'userEmail', 'firstName', 'lastName', 'userInitials', 'loggedIn', 'activePage'];
function storage() {
  const values = new Map();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, String(value)),
    removeItem: (name) => values.delete(name), clear: () => values.clear(),
  };
}
function element() {
  const classes = new Set();
  return {
    value: '', checked: false, disabled: false, style: {}, textContent: '', innerHTML: '',
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name); else classes.delete(name);
        return force;
      },
    },
  };
}
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const authData = (uid = 'uid-a', extra = {}) => ({
  localId: uid, email: `${uid}@example.invalid`, idToken: `token-${uid}`,
  refreshToken: `refresh-${uid}`, expiresIn: '3600', ...extra,
});
const refreshData = (uid = 'uid-a', extra = {}) => ({
  user_id: uid, id_token: `fresh-${uid}`, refresh_token: `rotated-${uid}`, expires_in: '3600', ...extra,
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function app(file = 'login.html', { local = storage(), session = storage(), respond } = {}) {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const events = new Map();
  const requests = [];
  const context = vm.createContext({
    URL, URLSearchParams, localStorage: local, sessionStorage: session,
    location: { href: `https://join.test/${file}`, search: '' },
    document: {
      getElementById: el, querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {},
    },
    addEventListener(name, callback) {
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(callback);
    },
    setTimeout() {}, setInterval() {}, console: { warn() {}, error() {} },
    fetch: async (input, options = {}) => {
      const url = new URL(input);
      assert.ok(['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', new URL(database).hostname].includes(url.hostname),
        `Unexpected host: ${url.hostname}`);
      const request = { url, ...options, method: options.method ?? 'GET' };
      requests.push(request);
      if (respond) return respond(request);
      if (url.hostname === 'identitytoolkit.googleapis.com') return reply(authData());
      if (url.hostname === 'securetoken.googleapis.com') return reply(refreshData());
      return reply({ firstname: 'Anna', lastname: 'Lee', initials: 'AL' });
    },
  });
  context.window = context;
  for (const { source, path } of pages.get(file).scripts) vm.runInContext(source, context, { filename: path });
  return {
    context, requests, local, session, el,
    emit: (name, event) => { for (const callback of events.get(name) ?? []) callback(event); },
  };
}

function seed(page, { remember = false, expired = false, uid = 'uid-a' } = {}) {
  const session = page.context.storeFirebaseAuth(authData(uid, expired ? { expiresIn: -1 } : {}), remember);
  for (const name of identityKeys) page.session.setItem(name, name === 'loggedInUserId' ? uid : 'previous-user');
  page.session.setItem('isUser', 'true');
  page.session.setItem('linksSidebarBoolienKey', 'true');
  page.local.setItem('isGuest', 'true');
  page.session.setItem('animationShown', 'true');
  page.local.setItem('unrelatedPreference', 'keep');
  return session;
}
function assertCleared(page) {
  assert.equal(page.session.getItem(key), null);
  assert.equal(page.local.getItem(key), null);
  for (const name of identityKeys) assert.equal(page.session.getItem(name), null, `stale ${name}`);
  assert.equal(page.session.getItem('isUser'), 'false');
  assert.equal(page.session.getItem('linksSidebarBoolienKey'), 'false');
  assert.equal(page.local.getItem('isGuest'), null);
  assert.equal(page.session.getItem('animationShown'), 'true');
  assert.equal(page.local.getItem('unrelatedPreference'), 'keep');
}

export {
  app, assertCleared, authData, database, deferred,
  identityKeys, key, pages, refreshData, reply,
  seed, storage
};
