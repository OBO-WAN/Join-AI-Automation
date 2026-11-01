import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { app, firebase, reply, signIn } from './helpers/profile-harness.mjs';

const first = { title: 'Disposable test task', status: 'triage' };
const second = { title: 'Other task', status: 'toDo' };

function board({ signedIn = true, guest = false, taskKey = 'test-task', deleteReply, readReply } = {}) {
  const records = new Map([[taskKey, first], ['other-task', second]]);
  const messages = [], renders = [];
  const server = firebase({ hook: async (request) => {
    if (request.url.hostname === 'securetoken.googleapis.com') return undefined;
    if (request.method === 'GET' && request.url.pathname === '/tasks.json') {
      if (readReply) return readReply(request, records);
      return reply(Object.fromEntries(records));
    }
    assert.equal(request.method, 'DELETE', 'Unexpected mutation');
    assert.equal(request.url.pathname, `/tasks/${encodeURIComponent(taskKey)}.json`);
    assert.equal(request.url.searchParams.get('auth'), signedIn ? 'token-a' : null);
    const response = deleteReply ? await deleteReply(request) : reply(null);
    if (response.ok) records.delete(taskKey);
    return response;
  } });
  const page = app('board.html', server);
  if (signedIn) signIn(page);
  if (guest) page.local.setItem('isGuest', 'true');
  page.context.alert = () => assert.fail('Native browser alerts are not allowed');
  const statusClasses = new Set(['d-none']);
  const detailStatus = {
    textContent: '',
    classList: {
      toggle(name, active) { if (active) statusClasses.add(name); else statusClasses.delete(name); },
      contains: (name) => statusClasses.has(name),
    },
  };
  const getElement = page.context.document.getElementById;
  page.context.document.getElementById = (id) => id === 'task_action_status'
    ? detailStatus : getElement(id);
  for (const status of [detailStatus, page.el('board_action_status')]) {
    let text = '';
    Object.defineProperty(status, 'textContent', {
      get: () => text,
      set(value) { text = value; if (value) messages.push(value); },
    });
  }
  page.context.renderCurrentTasks = () => renders.push('render');
  vm.runInContext('tasks = ' + JSON.stringify([
    { id: taskKey, title: first.title }, { id: 'other-task', title: second.title },
  ]), page.context);
  const overlay = page.el('overlay');
  overlay.dataset = { openTaskId: taskKey };
  overlay.querySelector = () => null;
  overlay.classList.remove('d-none');
  for (const id of ['confirm-yes', 'confirm-no']) {
    const element = page.el(id), listeners = new Set();
    element.addEventListener = (type, callback) => { assert.equal(type, 'click'); listeners.add(callback); };
    element.removeEventListener = (type, callback) => listeners.delete(callback);
    element.click = () => [...listeners].forEach((callback) => callback());
    element.listenerCount = () => listeners.size;
  }
  return { ...page, server, records, messages, renders, overlay, detailStatus,
    yes: () => page.el('confirm-yes').click(), no: () => page.el('confirm-no').click(),
    tasks: () => vm.runInContext('tasks', page.context),
    remove: (id = taskKey) => page.context.deleteTaskFromBoardPopup(id),
  };
}

test('cancel uses the actual confirmation dialog and sends no delete request', async () => {
  const page = board();
  const pending = page.remove();
  assert.equal(page.el('confirm-modal').classList.contains('d-none'), false);
  page.no();
  assert.equal(await pending, false);
  assert.equal(page.el('confirm-modal').classList.contains('d-none'), true);
  assert.equal(page.el('confirm-yes').listenerCount(), 0);
  assert.equal(page.server.requests.length, 0);
  assert.equal(page.tasks().length, 2);
  assert.equal(page.overlay.classList.contains('d-none'), false);
});

test('an expired or unselected session cannot silently become a Guest delete', async () => {
  const page = board({ signedIn: false });
  assert.equal(await page.remove(), false);
  assert.equal(page.server.requests.length, 0);
  assert.match(page.messages[0], /log in/i);
  assert.equal(page.tasks().length, 2);
});

for (const taskKey of ['test-task', '0', '17', '-legacyPushKey']) {
  test(`Guest can confirm deletion of existing task key ${taskKey} without creating an Auth account`, async () => {
    const page = board({ signedIn: false, guest: true, taskKey });
    const pending = page.remove();
    assert.equal(page.el('confirm-modal').classList.contains('d-none'), false);
    page.yes();
    assert.equal(await pending, true);
    assert.deepEqual([...page.records.keys()], ['other-task']);
    assert.equal(page.tasks()[0].id, 'other-task');
    assert.equal(page.context.getStoredFirebaseAuth(), null);
    assert.equal(page.local.getItem('isGuest'), 'true');
    assert.equal(page.server.requests.filter(({ method }) => method === 'DELETE').length, 1);
    assert.equal(page.messages.length, 0);
  });
}

test('Guest cancellation leaves an older task untouched', async () => {
  const page = board({ signedIn: false, guest: true, taskKey: '0' });
  const pending = page.remove();
  page.no();
  assert.equal(await pending, false);
  assert.equal(page.server.requests.length, 0);
  assert.equal(page.records.has('0'), true);
});

test('a Guest login change while confirming prevents deletion', async () => {
  const page = board({ signedIn: false, guest: true });
  const pending = page.remove();
  signIn(page);
  page.yes();
  assert.equal(await pending, false);
  assert.equal(page.server.requests.length, 0);
});

test('Guest mode ending while confirming prevents deletion', async () => {
  const page = board({ signedIn: false, guest: true });
  const pending = page.remove();
  page.local.removeItem('isGuest');
  page.yes();
  assert.equal(await pending, false);
  assert.equal(page.server.requests.length, 0);
});

test('Guest denied by unchanged Firebase rules sees a clear error and keeps the card', async () => {
  const page = board({ signedIn: false, guest: true, deleteReply: () => reply({ error: 'denied' }, 401) });
  const pending = page.remove();
  page.yes();
  assert.equal(await pending, false);
  assert.match(page.messages[0], /Guest task deletion is currently unavailable/);
  assert.equal(page.tasks().length, 2);
  assert.equal(page.overlay.classList.contains('d-none'), false);
});

for (const status of [200, 204]) {
  test(`authenticated delete (${status}) removes only the confirmed task and refreshes the public Board`, async () => {
    const page = board({ deleteReply: () => status === 204 ? new Response(null, { status }) : reply(null) });
    const pending = page.remove();
    page.yes();
    assert.equal(await pending, true);
    assert.deepEqual([...page.records.keys()], ['other-task']);
    assert.equal(page.tasks().length, 1);
    assert.equal(page.tasks()[0].id, 'other-task');
    assert.equal(page.overlay.classList.contains('d-none'), true);
    assert.equal(page.overlay.dataset.openTaskId, undefined);
    assert.equal(page.messages.length, 0);
    assert.equal(page.server.requests.filter(({ method }) => method === 'DELETE').length, 1);
    assert.equal(page.server.requests.at(-1).method, 'GET');
  });
}

for (const failure of [401, 403, 500, 'offline']) {
  test(`delete ${failure} leaves the card and detail open and displays the failure`, async () => {
    const page = board({ deleteReply: () => {
      if (failure === 'offline') throw new TypeError('Failed to fetch');
      return reply({ error: 'Permission denied' }, failure);
    } });
    const pending = page.remove();
    page.yes();
    assert.equal(await pending, false);
    assert.equal(page.tasks().length, 2);
    assert.equal(page.records.size, 2);
    assert.equal(page.overlay.classList.contains('d-none'), false);
    assert.equal(page.renders.length, 0);
    assert.equal(page.messages.length, 1);
    assert.equal(page.detailStatus.textContent, page.messages[0]);
    assert.equal(page.detailStatus.classList.contains('d-none'), false);
    assert.equal(page.server.requests.filter(({ method }) => method === 'GET').length, 0);
  });
}

test('repeated Delete clicks share one confirmation and one request', async () => {
  const page = board();
  const pending = page.remove();
  assert.equal(await page.remove(), false);
  assert.equal(page.el('confirm-yes').listenerCount(), 1);
  page.yes();
  await pending;
  assert.equal(page.server.requests.filter(({ method }) => method === 'DELETE').length, 1);
});

test('a session change while confirmation is open prevents the delete', async () => {
  const page = board();
  const pending = page.remove();
  signIn(page, 'uid-b');
  page.yes();
  assert.equal(await pending, false);
  assert.equal(page.server.requests.length, 0);
  assert.match(page.messages[0], /session changed/i);
});

test('an expired token refreshes through the existing auth helper before deletion', async () => {
  const page = board();
  const key = 'joinFirebaseAuth';
  const session = JSON.parse(page.session.getItem(key));
  page.session.setItem(key, JSON.stringify({ ...session, expiresAt: Date.now() - 1000 }));
  const pending = page.remove();
  page.yes();
  assert.equal(await pending, true);
  assert.equal(page.server.requests[0].url.hostname, 'securetoken.googleapis.com');
  assert.equal(page.server.requests[0].body.grant_type, 'refresh_token');
  assert.equal(page.server.requests[1].method, 'DELETE');
});

test('a successful delete remains successful when the follow-up Board read fails', async () => {
  const page = board({ readReply: () => reply({ error: 'offline' }, 503) });
  const pending = page.remove();
  page.yes();
  assert.equal(await pending, true);
  assert.equal(page.tasks().some((task) => task.id === 'test-task'), false);
  assert.match(page.messages[0], /was deleted.*refresh/i);
  assert.equal(page.el('board_action_status').textContent, page.messages[0]);
  assert.equal(page.el('board_action_status').classList.contains('d-none'), false);
});

test('retry clears the inline deletion error without opening a native alert', async () => {
  let attempts = 0;
  const page = board({ deleteReply: () => ++attempts === 1 ? reply({ error: 'denied' }, 401) : reply(null) });
  const firstAttempt = page.remove();
  page.yes();
  assert.equal(await firstAttempt, false);
  assert.notEqual(page.detailStatus.textContent, '');
  const retry = page.remove();
  assert.equal(page.detailStatus.textContent, '');
  assert.equal(page.detailStatus.classList.contains('d-none'), true);
  page.yes();
  assert.equal(await retry, true);
});

test('deletion does not close a different task opened while its request was pending', async () => {
  let release;
  const gate = new Promise((done) => { release = done; });
  const page = board({ deleteReply: async () => { await gate; return reply(null); } });
  const pending = page.remove();
  page.yes();
  await new Promise(setImmediate);
  page.overlay.dataset.openTaskId = 'other-task';
  release();
  assert.equal(await pending, true);
  assert.equal(page.overlay.classList.contains('d-none'), false);
  assert.equal(page.overlay.dataset.openTaskId, 'other-task');
});

test('an old in-flight task read cannot restore a deleted task', async () => {
  let release, reads = 0;
  const gate = new Promise((done) => { release = done; });
  const page = board({ readReply: async (request, records) => {
    const snapshot = Object.fromEntries(records);
    if (++reads === 1) await gate;
    return reply(snapshot);
  } });
  const staleRead = page.context.loadTasksFromFirebase();
  const pending = page.remove();
  page.yes();
  assert.equal(await pending, true);
  release();
  await staleRead;
  assert.equal(page.tasks().some((task) => task.id === 'test-task'), false);
});

for (const invalid of ['', '../tasks', 'bad/key', 'bad#key', undefined]) {
  test(`invalid task key ${JSON.stringify(invalid)} cannot target a database path`, async () => {
    const page = board();
    assert.equal(await page.context.deleteTaskFromBoardPopup(invalid), false);
    assert.equal(page.server.requests.length, 0);
    assert.match(page.messages[0], /identified/i);
  });
}
