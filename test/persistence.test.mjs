import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenarioStorage, STORAGE_KEY } from '../src/persistence.mjs';
import { createDemo, createMaze } from '../src/pathfinding.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

test('autosave round-trip restores only a validated scenario with independent cells', () => {
  const memory = memoryStorage(), persistence = createScenarioStorage(() => memory);
  assert.deepEqual(persistence.load(), { status: 'empty' });
  const board = { ...createMaze('saved'), selectedTool: 'wall', replay: [1, 2, 3] };
  assert.equal(persistence.save(board).status, 'saved');
  const restored = persistence.load();
  assert.equal(restored.status, 'restored');
  assert.deepEqual(restored.board, createMaze('saved'));
  restored.board.cells[1] = 9;
  assert.deepEqual(persistence.load().board, createMaze('saved'));
});

test('corrupt, unsupported, oversized and schema-invalid saved data are ignored safely', () => {
  const memory = memoryStorage(), persistence = createScenarioStorage(() => memory);
  for (const raw of ['{broken', 'null', JSON.stringify({ ...createDemo(), version: 2 }),
    JSON.stringify({ ...createDemo(), cells: [1] }), ' '.repeat(100_001)]) {
    memory.setItem(STORAGE_KEY, raw);
    assert.deepEqual(persistence.load(), { status: 'corrupt' });
  }
  persistence.save(createDemo());
  assert.equal(persistence.load().status, 'restored', 'a later edit replaces corrupt state');
});

test('storage getter restrictions, unavailable methods and quota errors remain recoverable', () => {
  for (const getStorage of [() => { throw new Error('Blocked'); }, () => undefined, () => ({
    getItem() { throw new Error('Read denied'); },
    setItem() { throw new Error('Quota exceeded'); },
    removeItem() { throw new Error('Delete denied'); },
  })]) {
    const persistence = createScenarioStorage(getStorage);
    assert.deepEqual(persistence.load(), { status: 'unavailable' });
    assert.deepEqual(persistence.save(createDemo()), { status: 'unavailable' });
    assert.deepEqual(persistence.clear(), { status: 'unavailable' });
  }
});

test('forget removes only RouteLab state and invalid application data never overwrites it', () => {
  const memory = memoryStorage(), persistence = createScenarioStorage(() => memory);
  memory.setItem('another-app', 'keep');
  persistence.save(createDemo());
  assert.throws(() => persistence.save({ ...createDemo(), width: 99 }));
  assert.deepEqual(persistence.load().board, createDemo());
  assert.deepEqual(persistence.clear(), { status: 'cleared' });
  assert.deepEqual(persistence.load(), { status: 'empty' });
  assert.equal(memory.getItem('another-app'), 'keep');
  persistence.save(createMaze('next-edit'));
  assert.deepEqual(persistence.load().board, createMaze('next-edit'));
});
