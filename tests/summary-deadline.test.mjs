import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../script/summary.js', import.meta.url), 'utf8');

function summaryPage() {
  const elements = new Map();
  const element = (key) => {
    if (!elements.has(key)) elements.set(key, { textContent: '', style: {} });
    return elements.get(key);
  };
  const numbers = [element('total'), element('progress'), element('feedback')];
  const context = vm.createContext({
    document: {
      querySelector: element,
      querySelectorAll: (selector) => selector === '.tasknmb' ? numbers : [],
      getElementById: element,
    },
    window: { matchMedia: () => ({ matches: false }) },
    sessionStorage: { getItem: () => 'true' },
    setInterval() {}, console,
  });
  vm.runInContext(source, context);
  return { context, element };
}

const task = (dueDate, extra = {}) => ({ status: 'toDo', priority: 'urgent', dueDate, ...extra });

test('earliest unfinished urgent deadline is selected without changing the existing counts', () => {
  const { context } = summaryPage();
  const stats = context.computeTaskStats({
    later: task('12-11-2026'), earlier: task('09-11-2026', { source: { type: 'email' } }),
    completed: task('01-11-2026', { status: 'done' }),
    normal: task('02-11-2026', { priority: 'medium' }),
  });
  assert.equal(stats.upcomingDeadline.getFullYear(), 2026);
  assert.equal(stats.upcomingDeadline.getMonth(), 10);
  assert.equal(stats.upcomingDeadline.getDate(), 9);
  assert.equal(stats.tasksInBoard, 4);
  assert.equal(stats.urgent, 3);
  assert.equal(stats.todo, 3);
  assert.equal(stats.done, 1);
  assert.equal(stats.emailRequests, 1);
});

for (const value of ['', null, 'invalid', '31-02-2026', '00-11-2026', '09-13-2026', '29-02-2026']) {
  test(`invalid or missing date ${JSON.stringify(value)} does not become a deadline`, () => {
    const { context } = summaryPage();
    assert.equal(context.computeTaskStats({ bad: task(value) }).upcomingDeadline, null);
  });
}

test('valid leap days and unpadded project dates are interpreted as local calendar dates', () => {
  const { context } = summaryPage();
  assert.equal(context.parseSummaryDueDate('29-02-2028').getDate(), 29);
  const date = context.parseSummaryDueDate('9-1-2026');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 0);
  assert.equal(date.getDate(), 9);
  assert.equal(date.getHours(), 0);
});

test('overdue unfinished work remains eligible instead of disappearing from the deadline', () => {
  const { context } = summaryPage();
  const stats = context.computeTaskStats({ overdue: task('01-01-2020'), future: task('01-01-2090') });
  assert.equal(stats.upcomingDeadline.getFullYear(), 2020);
});

test('rendering empty data clears a previously displayed deadline', () => {
  const { context, element } = summaryPage();
  context.updateTaskSummaryDisplay(context.computeTaskStats({ one: task('09-11-2026') }));
  assert.match(element('.date').textContent, /2026/);
  context.updateTaskSummaryDisplay(context.computeTaskStats({}));
  assert.equal(element('.date').textContent, '—');
});

test('UI setup cannot replace an already loaded deadline with today', () => {
  const { context, element } = summaryPage();
  context.updateTaskSummaryDisplay(context.computeTaskStats({ one: task('09-11-2026') }));
  const rendered = element('.date').textContent;
  context.setupSummaryUI();
  assert.equal(element('.date').textContent, rendered);
});
