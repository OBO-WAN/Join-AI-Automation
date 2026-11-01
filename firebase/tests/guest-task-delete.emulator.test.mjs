import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, test } from 'node:test';
import vm from 'node:vm';
import { app, firebase } from '../../tests/helpers/profile-harness.mjs';

// This suite can address only a loopback emulator and a disposable demo namespace.
const origin = 'http://127.0.0.1:9001';
const namespace = 'demo-join-guest-delete';
const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
const fixture = {
  tasks: {
    0: { title: 'Old demo card', status: 'done', createdAt: '2025-01-01', subTasks: [{ task: 'Demo' }] },
    '-demo-push-key': { title: 'New demo card', status: 'triage' },
  },
  contacts: { c1: { name: 'Demo Contact', mail: 'demo@example.test' } },
  user: { 'member-demo': { firstname: 'Demo', lastname: 'Member' } },
  members: { 'editor-demo': { role: 'editor' }, 'member-demo': { role: 'member' } },
  automationUsage: { demo: { count: 1 } },
  randomColorsJson: { demo: ['#000000'] },
};

async function request(path, { admin = false, auth, method = 'GET', body } = {}) {
  const url = new URL(path + '.json', origin);
  url.searchParams.set('ns', namespace);
  if (auth) url.searchParams.set('auth', auth);
  return fetch(url, {
    method, headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer owner' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function mockToken(uid) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({
    iss: 'https://securetoken.google.com/' + namespace, aud: namespace,
    sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'password', identities: {} },
  }) + '.';
}

for (const parentPolicy of ['repository editor rule', 'auth-required task writes']) {
  describe('Guest task actions with ' + parentPolicy, () => {
    let policy;
    beforeEach(async () => {
      policy = structuredClone(rules);
      if (parentPolicy === 'auth-required task writes') policy.rules.tasks['.write'] = 'auth != null';
      const setRules = await request('/.settings/rules', { admin: true, method: 'PUT', body: policy });
      assert.equal(setRules.status, 200, await setRules.text());
      const seed = await request('/', { admin: true, method: 'PUT', body: fixture });
      assert.equal(seed.status, 200, await seed.text());
    });

    test('Guest reads tasks and deletes an old numeric key while preserving another task', async () => {
      assert.equal((await request('/tasks')).status, 200);
      const removed = await request('/tasks/0', { method: 'DELETE' });
      assert.equal(removed.status, 200, await removed.text());
      const data = await (await request('/tasks')).json();
      assert.equal(data[0], undefined);
      assert.equal(data['-demo-push-key'].title, 'New demo card');
    });

    test('Guest can delete a push key as well as an old numeric key', async () => {
      assert.equal((await request('/tasks/-demo-push-key', { method: 'DELETE' })).status, 200);
      const data = await (await request('/tasks')).json();
      assert.equal(data[0].title, 'Old demo card');
    });

    for (const status of ['triage', 'toDo', 'inProgress', 'awaitFeedback', 'done']) {
      test('Guest can PATCH only the drag fields to ' + status, async () => {
        for (const key of ['0', '-demo-push-key']) {
          const before = await (await request('/tasks/' + key)).json();
          const statusChangedAt = '2026-11-01T12:00:00.000Z';
          const moved = await request('/tasks/' + key, {
            method: 'PATCH', body: { status, statusChangedAt },
          });
          assert.equal(moved.status, 200, await moved.text());
          const after = await (await request('/tasks/' + key)).json();
          assert.deepEqual(after, { ...before, status, statusChangedAt });
        }
      });
    }

    test('actual moveTo rolls back with delete-only Rules, then persists with corrected Rules; deletion still works', async () => {
      const deleteOnly = structuredClone(policy);
      delete deleteOnly.rules.tasks.$taskId.status;
      delete deleteOnly.rules.tasks.$taskId.statusChangedAt;
      assert.equal((await request('/.settings/rules', { admin: true, method: 'PUT', body: deleteOnly })).status, 200);
      const feedback = [];
      const server = firebase({ hook: (entry) => {
        assert.equal(entry.url.hostname, 'join-ai-automation-default-rtdb.europe-west1.firebasedatabase.app');
        assert.match(entry.url.pathname, /^\/tasks(?:\/[^/]+)?\.json$/);
        assert.equal(entry.url.searchParams.get('auth'), null);
        return request(entry.url.pathname.slice(0, -5), { method: entry.method, body: entry.body });
      } });
      const page = app('board.html', server);
      page.local.setItem('isGuest', 'true');
      page.context.cleanupDrag = () => vm.runInContext('currentDraggedElement = null', page.context);
      page.context.renderCurrentTasks = () => {};
      page.context.refreshOpenTaskOverlay = () => {};
      page.context.showToast = (message) => feedback.push(message);
      await page.context.loadTasksFromFirebase();
      vm.runInContext('currentDraggedElement = "0"', page.context);
      await page.context.moveTo('inProgress');
      assert.equal((await (await request('/tasks/0')).json()).status, 'done');
      assert.equal(vm.runInContext('tasks.find(task => task.id === "0").status', page.context), 'done');
      assert.equal(feedback.length, 1);

      assert.equal((await request('/.settings/rules', { admin: true, method: 'PUT', body: policy })).status, 200);
      vm.runInContext('currentDraggedElement = "0"', page.context);
      await page.context.moveTo('inProgress');
      const saved = await (await request('/tasks/0')).json();
      assert.equal(saved.status, 'inProgress');
      assert.match(saved.statusChangedAt, /^\d{4}-\d\d-\d\dT/);
      assert.equal(saved.title, fixture.tasks[0].title);
      assert.equal(vm.runInContext('tasks.find(task => task.id === "0").status', page.context), 'inProgress');
      assert.equal(feedback.length, 1);
      assert.equal((await request('/tasks/0', { method: 'DELETE' })).status, 200);
      assert.equal(await (await request('/tasks/0')).json(), null);
    });

    for (const [name, path, method, body] of [
      ['create a task', '/tasks/new-demo', 'PUT', { title: 'Forbidden' }],
      ['POST a task', '/tasks', 'POST', { title: 'Forbidden' }],
      ['edit a task', '/tasks/0', 'PATCH', { title: 'Forbidden' }],
      ['replace a task', '/tasks/0', 'PUT', { title: 'Forbidden' }],
      ['write an unsupported status', '/tasks/0/status', 'PUT', 'hidden'],
      ['delete status alone', '/tasks/0/status', 'DELETE'],
      ['write a non-string timestamp', '/tasks/0/statusChangedAt', 'PUT', 123],
      ['delete a title while moving', '/tasks/0', 'PATCH', { status: 'toDo', title: null }],
      ['edit a title while moving', '/tasks/0', 'PATCH', { status: 'toDo', title: 'Forbidden' }],
      ['create a task using drag fields', '/tasks/new-demo', 'PATCH', { status: 'toDo', statusChangedAt: '2026-11-01T12:00:00.000Z' }],
      ['delete a subtask', '/tasks/0/subTasks/0', 'DELETE'],
      ['delete the task collection root', '/tasks', 'DELETE'],
      ['delete the database root', '/', 'DELETE'],
      ['read contacts', '/contacts', 'GET'],
      ['delete contacts', '/contacts/c1', 'DELETE'],
      ['read a profile', '/user/member-demo', 'GET'],
      ['delete a profile', '/user/member-demo', 'DELETE'],
      ['write usage', '/automationUsage/demo', 'PUT', { count: 0 }],
      ['delete colors', '/randomColorsJson/demo', 'DELETE'],
      ['grant membership', '/members/visitor', 'PUT', { role: 'editor' }],
      ['delete a nonexistent task', '/tasks/missing-demo', 'DELETE'],
    ]) {
      test('Guest cannot ' + name, async () => {
        const response = await request(path, { method, body });
        assert.equal(response.status, 401, await response.text());
        const data = await (await request('/', { admin: true })).json();
        assert.deepEqual(data, fixture);
      });
    }

    test('an atomic mixed update cannot delete a task together with protected data', async () => {
      const response = await request('/', { method: 'PATCH', body: { 'tasks/0': null, 'contacts/c1': null } });
      assert.equal(response.status, 401);
      assert.deepEqual(await (await request('/', { admin: true })).json(), fixture);
    });

    test('the existing signed-in editor can still create and edit tasks', async () => {
      const auth = mockToken('editor-demo');
      const created = await request('/tasks/editor-new', { auth, method: 'PUT', body: { title: 'Created' } });
      assert.equal(created.status, 200, await created.text());
      const edited = await request('/tasks/editor-new', { auth, method: 'PATCH', body: { title: 'Edited' } });
      assert.equal(edited.status, 200, await edited.text());
    });

    test('the original parent rule still determines ordinary member creation rights', async () => {
      const response = await request('/tasks/member-new', {
        auth: mockToken('member-demo'), method: 'PUT', body: { title: 'Member task' },
      });
      assert.equal(response.status, parentPolicy === 'auth-required task writes' ? 200 : 401,
        await response.text());
    });
  });
}
