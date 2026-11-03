import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../script/summary.js', import.meta.url), 'utf8');
const fieldSelectors = ['.summarynmb.todo', '.summarynmb.done', '.urgentnmb', '.summary-email-count', 'total', 'progress', 'feedback', '.date'];
const task = { status: 'toDo', priority: 'urgent', dueDate: '09-11-2026' };

function summaryPage(respond) {
  const fields = new Map(fieldSelectors.map((key) => [key, { textContent: 'sample' }]));
  const classes = new Set(['d-none']);
  const status = { classList: {
    add: (name) => classes.add(name), remove: (name) => classes.delete(name),
  } };
  const retry = { disabled: false };
  const requests = [];
  const context = vm.createContext({
    document: {
      querySelector: (selector) => fields.get(selector),
      querySelectorAll: (selector) => selector === '.tasknmb'
        ? ['total', 'progress', 'feedback'].map((key) => fields.get(key)) : [...fields.values()],
      getElementById: (id) => id === 'summary_task_status' ? status : retry,
    },
    BASE_URL: 'https://example.invalid/',
    fetch: async (url) => { requests.push(url); return respond(); },
    console: { error() {} },
  });
  vm.runInContext(source, context);
  return { context, fields, classes, retry, requests };
}

for (const failure of ['HTTP error', 'offline', 'invalid JSON']) {
  test(`${failure} clears misleading figures, shows feedback and permits a successful retry`, async () => {
    let failing = true;
    const page = summaryPage(() => {
      if (!failing) return { ok: true, json: async () => ({ one: task }) };
      if (failure === 'offline') throw new TypeError('Offline');
      return { ok: failure !== 'HTTP error', status: 500,
        json: async () => { throw new SyntaxError('Invalid JSON'); } };
    });
    await page.context.updateTaskData();
    assert.ok([...page.fields.values()].every((field) => field.textContent === '—'));
    assert.equal(page.classes.has('d-none'), false);
    assert.equal(page.retry.disabled, false);
    failing = false;
    await page.context.updateTaskData();
    assert.equal(page.fields.get('.summarynmb.todo').textContent, 1);
    assert.match(page.fields.get('.date').textContent, /2026/);
    assert.equal(page.classes.has('d-none'), true);
    assert.equal(page.requests.length, 2);
  });
}

test('a failed refresh clears the previously loaded figures instead of displaying stale totals', async () => {
  let failing = false;
  const page = summaryPage(() => ({ ok: !failing, status: 500, json: async () => ({ one: task }) }));
  await page.context.updateTaskData();
  assert.equal(page.fields.get('total').textContent, 1);
  failing = true;
  await page.context.updateTaskData();
  assert.equal(page.fields.get('total').textContent, '—');
  assert.equal(page.classes.has('d-none'), false);
});

test('concurrent retry or polling calls share the pending request and release the disabled button', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const page = summaryPage(() => pending);
  const first = page.context.updateTaskData();
  assert.equal(page.retry.disabled, true);
  await page.context.updateTaskData();
  assert.equal(page.requests.length, 1);
  release({ ok: true, json: async () => null });
  await first;
  assert.equal(page.fields.get('total').textContent, 0);
  assert.equal(page.retry.disabled, false);
  assert.equal(page.classes.has('d-none'), true);
});
