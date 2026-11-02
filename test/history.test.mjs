import test from 'node:test';
import assert from 'node:assert/strict';
import { BoardHistory } from '../src/history.mjs';
import { createDemo, createMaze, solve } from '../src/pathfinding.mjs';

const empty = () => ({ version: 1, width: 3, height: 3, cells: Array(9).fill(1), start: 0, goal: 8 });
function edit(history, index, cost) {
  const next = history.current; next.cells[index] = cost; return history.replace(next);
}

test('one pointer transaction undoes and redoes its entire stroke', () => {
  const original = empty(), history = new BoardHistory(original);
  history.begin();
  edit(history, 1, 0); edit(history, 2, 5); edit(history, 4, 9);
  assert.equal(history.undoCount, 0);
  assert.equal(history.canUndo, true);
  assert.equal(history.end(), true);
  assert.equal(history.end(), false, 'pointerup followed by lostpointercapture finishes once');
  assert.equal(history.undoCount, 1);
  const painted = history.current;
  assert.deepEqual(history.undo(), original);
  assert.deepEqual(history.redo(), painted);
});

test('undo finishes an active stroke; repeated begin never replaces its baseline', () => {
  const original = empty(), history = new BoardHistory(original);
  history.begin(); edit(history, 1, 0);
  history.begin(); edit(history, 2, 0);
  assert.deepEqual(history.undo(), original);
  assert.equal(history.redoCount, 1);
  assert.deepEqual(history.redo().cells, [1, 0, 0, 1, 1, 1, 1, 1, 1]);
});

test('a new edit clears redo, while no-op commands and reverted strokes preserve it', () => {
  const history = new BoardHistory(empty());
  edit(history, 1, 5); const future = history.current;
  history.undo();
  assert.equal(history.replace(history.current), false);
  history.begin(); edit(history, 2, 0); edit(history, 2, 1);
  assert.equal(history.end(), false);
  assert.deepEqual(history.redo(), future);
  history.undo(); edit(history, 4, 7);
  assert.equal(history.canRedo, false);
  assert.equal(history.redo(), null);
});

test('board commands preserve dimensions, endpoints and weights through history travel', () => {
  const history = new BoardHistory(createDemo()), original = history.current;
  const maze = createMaze('history-test', 11, 9);
  history.replace(maze);
  const imported = empty(); imported.cells[4] = 9; imported.start = 2; imported.goal = 6;
  history.replace(imported);
  assert.deepEqual(history.undo(), maze);
  assert.deepEqual(history.undo(), original);
  assert.deepEqual(history.redo(), maze);
  assert.deepEqual(history.redo(), imported);
  assert.equal(solve(history.current).cost, solve(imported).cost);
});

test('history memory stays bounded across many edits and complete undo/redo cycles', () => {
  const history = new BoardHistory(empty(), 3), versions = [history.current];
  for (let i = 2; i <= 9; i++) { edit(history, 1, i); versions.push(history.current); }
  assert.equal(history.undoCount, 3);
  assert.deepEqual(history.undo(), versions[7]);
  assert.deepEqual(history.undo(), versions[6]);
  assert.deepEqual(history.undo(), versions[5]);
  assert.equal(history.undo(), null);
  assert.equal(history.redoCount, 3);
  while (history.canRedo) history.redo();
  assert.deepEqual(history.current, versions[8]);
  assert.equal(history.undoCount, 3);
  edit(history, 2, 4);
  assert.equal(history.undoCount, 3);
});

test('invalid edits and caller mutations cannot corrupt a history snapshot', () => {
  const input = empty(), history = new BoardHistory(input);
  input.cells[0] = 0;
  const exposed = history.current; exposed.cells[0] = 0;
  assert.equal(history.current.cells[0], 1);
  history.begin(); edit(history, 1, 5);
  assert.throws(() => history.replace({ ...history.current, goal: 0 }));
  history.end(); const old = history.undo(); old.cells[2] = 9;
  assert.equal(history.current.cells[2], 1);
  assert.equal(history.redo().cells[1], 5);
  for (const limit of [0, 101, Infinity, 2.5]) assert.throws(() => new BoardHistory(empty(), limit));
});
