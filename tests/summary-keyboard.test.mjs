import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../script/summary.js', import.meta.url), 'utf8');

function summaryActions() {
  const groups = Array.from({ length: 4 }, () => ({
    tabIndex: -1, attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
  }));
  const destinations = [];
  const location = { set href(value) { destinations.push(value); } };
  const context = vm.createContext({
    document: { querySelectorAll: () => groups },
    window: { location },
  });
  vm.runInContext(source, context);
  context.addClickEvents();
  return { groups, destinations };
}

test('all four existing metric groups gain button semantics while preserving mouse navigation', () => {
  const { groups, destinations } = summaryActions();
  for (const group of groups) {
    assert.equal(group.tabIndex, 0);
    assert.equal(group.attributes.get('role'), 'button');
    group.onclick();
  }
  assert.deepEqual(destinations, Array(4).fill('board.html'));
});

for (const key of ['Enter', ' ']) {
  test(`${JSON.stringify(key)} opens Board and prevents the browser's default action`, () => {
    const { groups, destinations } = summaryActions();
    let prevented = 0;
    for (const group of groups) group.onkeydown({ key, repeat: false, preventDefault: () => prevented++ });
    assert.equal(prevented, 4);
    assert.deepEqual(destinations, Array(4).fill('board.html'));
  });
}

test('other keys keep their default browser behavior and do not navigate', () => {
  const { groups, destinations } = summaryActions();
  for (const key of ['Tab', 'Escape', 'ArrowDown']) {
    groups[0].onkeydown({ key, preventDefault: () => assert.fail('Default action should remain') });
  }
  assert.deepEqual(destinations, []);
});

test('holding an activation key does not cause repeated navigation', () => {
  const { groups, destinations } = summaryActions();
  groups[0].onkeydown({ key: 'Enter', repeat: true, preventDefault: () => assert.fail('Repeated key should be ignored') });
  assert.deepEqual(destinations, []);
});
