import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { app, firebase, reply, signIn } from './helpers/profile-harness.mjs';

const root = new URL('../', import.meta.url);
const source = (name) => readFileSync(new URL(name, root), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));
const initial = [
  { id: 'z-original', name: 'Zoe Lee', mail: 'zoe@example.test', custom: 'keep' },
  null,
  { id: 'a-original', name: 'Alex Doe', mail: 'alex@example.test', phone: '123' },
];

function contactsPage({ records = initial, hook } = {}) {
  const database = new Map(Object.entries(clone(records)).filter(([, value]) => value !== null));
  const requests = [], alerts = [], events = [];
  const storage = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key) };
  };
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', classList: { add() {}, remove() {} } });
    return elements.get(id);
  };
  const context = vm.createContext({
    URL, URLSearchParams, console, sessionStorage: storage(), localStorage: storage(),
    location: { href: 'https://join.test/contacts.html' }, addEventListener() {},
    document: { getElementById: element }, alert: (message) => alerts.push(message),
    fetch: async (input, options = {}) => {
      const url = new URL(input);
      const request = { url, method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body) : undefined };
      requests.push(request);
      assert.equal(url.hostname, 'join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app');
      assert.equal(url.searchParams.get('auth'), 'token-a');
      if (hook) { const result = await hook(request); if (result) return result; }
      const key = url.pathname.match(/^\/contacts\/([^/]+)\.json$/)?.[1];
      if (request.method === 'GET') return reply(Object.fromEntries(database));
      if (request.method === 'POST') { database.set('-new-contact', request.body); return reply({ name: '-new-contact' }); }
      assert.ok(key, 'Writes must address one existing record');
      if (request.method === 'PATCH') { database.set(key, { ...database.get(key), ...request.body }); return reply(request.body); }
      assert.equal(request.method, 'DELETE');
      database.delete(key);
      return reply(null);
    },
    getViewMode: () => 1, clearViewCard: () => events.push('clear'),
    renderContacts: (list) => { list.sort((a, b) => a.name.localeCompare(b.name)); events.push('render'); },
    closeContactDialog: () => events.push('close'), closeContactDialogMobile() {},
    renderViewCard: (index) => events.push(['view', index]), goBacktoContacts() {},
    capitalizeWords: (name) => name,
  });
  context.window = context;
  for (const file of ['script/firebase_auth.js', 'script/contacts_data.js', 'script/contacts.js']) {
    vm.runInContext(source(file), context, { filename: file });
  }
  context.storeFirebaseAuth({ localId: 'uid-a', email: 'a@example.test', idToken: 'token-a', refreshToken: 'refresh-a' });
  return { context, database, requests, alerts, events, element,
    list: () => vm.runInContext('Contacts', context) };
}

test('Contacts HTML loads managed authentication and the new data helper before use', () => {
  const html = source('contacts.html');
  assert.ok(html.indexOf('firebase_auth.js') < html.indexOf('contacts_data.js'));
  assert.ok(html.indexOf('contacts_data.js') < html.indexOf('script/contacts.js'));
  assert.doesNotMatch(source('script/contacts.js'), /joinstorage-ef266|updateDatabase/);
});

test('sorting and editing retain Firebase keys, IDs and additional profile fields', async () => {
  const page = contactsPage();
  await page.context.getContacts();
  assert.equal(page.list()[0].id, 'a-original');
  page.element('name_input_pc').value = 'Aaron Lee';
  await page.context.saveEditedContact(1, '_pc', 'Aaron Lee', 'new@example.test', '999', 1);
  const write = page.requests.find((request) => request.method === 'PATCH');
  assert.equal(write.url.pathname, '/contacts/0.json');
  assert.equal(write.body.id, 'z-original');
  assert.equal(write.body.custom, 'keep');
  assert.equal(page.database.get('2').id, 'a-original');
  assert.equal(page.database.get('0').name, 'Aaron Lee');
  assert.deepEqual(page.events.at(-2), ['view', 0]);
});

test('creation uses a new Firebase key without replacing or renumbering contacts', async () => {
  const page = contactsPage();
  await page.context.getContacts();
  await page.context.addContactAndUpdateUI({ name: 'New User', mail: 'new@example.test' });
  assert.equal(page.requests.at(-1).method, 'POST');
  assert.equal(page.database.get('0').id, 'z-original');
  assert.equal(page.database.get('2').id, 'a-original');
  assert.equal(page.database.size, 3);
  assert.equal(page.list().length, 3);
});

for (const confirm of [false, true]) {
  test(`deletion ${confirm ? 'with confirmation' : 'from detail'} deletes only the selected stable key`, async () => {
    const page = contactsPage();
    await page.context.getContacts();
    if (confirm) {
      vm.runInContext('contactToDelete = 0', page.context);
      await page.context.confirmDeleteContact();
    } else await page.context.deleteContact(0);
    assert.equal(page.requests.at(-1).url.pathname, '/contacts/2.json');
    assert.equal(page.database.size, 1);
    assert.equal(page.database.get('0').id, 'z-original');
  });
}

for (const status of [401, 403, 500]) {
  test(`denied save (${status}) preserves the visible list and leaves the form open`, async () => {
    const page = contactsPage({ hook: ({ method }) => method === 'GET' ? undefined : reply({ error: 'denied' }, status) });
    await page.context.getContacts();
    const before = clone(page.list());
    page.element('name_input_pc').value = 'Changed Name';
    await page.context.saveEditedContact(0, '_pc', 'Changed Name', 'x@example.test', '123', 1);
    await page.context.addContactAndUpdateUI({ name: 'New User' });
    await page.context.deleteContact(0);
    assert.deepEqual(clone(page.list()), before);
    assert.equal(page.events.includes('close'), false);
    assert.equal(page.alerts.length, 3);
    assert.equal(page.database.size, 2);
  });
}

test('guest Contacts never requests the private database', async () => {
  const page = contactsPage();
  page.context.firebaseAuthLogout();
  await page.context.getContacts();
  assert.equal(page.requests.length, 0);
  assert.match(page.element('contact_card_section').textContent, /log in/i);
});

test('an account switch rejects contacts loaded under the previous account', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const page = contactsPage({ hook: async () => { await gate; return reply(initial); } });
  const pending = page.context.getContacts();
  await new Promise(setImmediate);
  page.context.firebaseAuthLogout();
  release();
  await pending;
  assert.equal(page.list().length, 0);
  assert.match(page.element('contact_card_section').textContent, /log in/i);
});

test('duplicate creates while a save is pending send a single request', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const page = contactsPage({ hook: async ({ method }) => { if (method === 'POST') await gate; } });
  await page.context.getContacts();
  const pending = page.context.addContactAndUpdateUI({ name: 'New User' });
  await page.context.addContactAndUpdateUI({ name: 'New User' });
  release();
  await pending;
  assert.equal(page.requests.filter(({ method }) => method === 'POST').length, 1);
});

test('guest Board does not request private contacts', async () => {
  const server = firebase({ hook: () => { throw new Error('Unexpected private request'); } });
  app('board.html', server);
  await new Promise(setImmediate);
  assert.equal(server.requests.length, 0);
});

for (const data of [initial, { 0: initial[0], '-new-contact': initial[2] }, null]) {
  test(`authenticated assignees accept ${data === null ? 'empty' : Array.isArray(data) ? 'array' : 'keyed'} Firebase data`, async () => {
    const server = firebase({ hook: () => reply(data) });
    const page = app('board.html', server);
    signIn(page);
    let rendered = 0;
    page.context.renderAssigneeDropdown = () => { rendered++; };
    await page.context.loadContacts();
    assert.equal(vm.runInContext('Contacts.length', page.context), data === null ? 0 : 2);
    assert.equal(server.requests[0].url.searchParams.get('auth'), 'token-a');
    assert.equal(rendered, 1);
  });
}

test('a rejected assignee read does not treat an error response as contacts', async () => {
  const server = firebase({ hook: () => reply({ error: 'denied' }, 401) });
  const page = app('board.html', server);
  signIn(page);
  page.context.renderAssigneeDropdown = () => assert.fail('Denied data must not render');
  await page.context.loadContacts();
  assert.equal(vm.runInContext('Contacts.length', page.context), 0);
});
