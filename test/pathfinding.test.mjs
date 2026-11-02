import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, validateBoard, createDemo, createMaze, neighbors } from '../src/pathfinding.mjs';

function grid(width, height, start, goal, cells = Array(width * height).fill(1)) {
  return { version: 1, width, height, start, goal, cells };
}

function assertValidPath(board, result) {
  assert.equal(new Set(result.visitedOrder).size, result.visitedOrder.length, 'each expanded cell appears once');
  if (!result.reached) { assert.deepEqual(result.path, []); assert.equal(result.cost, null); return; }
  assert.equal(result.path[0], board.start);
  assert.equal(result.path.at(-1), board.goal);
  for (let i = 1; i < result.path.length; i++) {
    const a = result.path[i - 1], b = result.path[i];
    assert.equal(Math.abs(a % board.width - b % board.width) + Math.abs(Math.floor(a / board.width) - Math.floor(b / board.width)), 1);
    assert.ok(board.cells[b] > 0);
  }
  assert.equal(result.cost, result.path.slice(1).reduce((sum, i) => sum + board.cells[i], 0));
}

// Independent oracle: exhaustive edge relaxation, without a heap or heuristic.
function referenceCost(board) {
  const distance = board.cells.map(() => Infinity); distance[board.start] = 0;
  const edges = [];
  for (let y = 0; y < board.height; y++) for (let x = 0; x < board.width; x++) {
    const from = y * board.width + x; if (!board.cells[from]) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= board.width || ny < 0 || ny >= board.height) continue;
      const to = ny * board.width + nx;
      if (board.cells[to]) edges.push([from, to]);
    }
  }
  for (let pass = 0; pass < board.cells.length - 1; pass++) {
    let changed = false;
    for (const [from, to] of edges) if (distance[from] + board.cells[to] < distance[to]) {
      distance[to] = distance[from] + board.cells[to]; changed = true;
    }
    if (!changed) break;
  }
  return Number.isFinite(distance[board.goal]) ? distance[board.goal] : null;
}

test('BFS minimizes moves while weighted algorithms take a cheaper detour', () => {
  const board = grid(5, 3, 5, 9); board.cells[6] = board.cells[7] = board.cells[8] = 8;
  const bfs = solve(board, 'bfs'); assert.equal(bfs.steps, 4); assert.equal(bfs.cost, 25);
  for (const algorithm of ['astar', 'dijkstra']) {
    const result = solve(board, algorithm); assert.equal(result.cost, 6); assert.equal(result.steps, 6);
    assertValidPath(board, result);
  }
});

test('start cell is free and entering the weighted target has a cost', () => {
  const board = grid(3, 3, 0, 1); board.cells[0] = 9; board.cells[1] = 7;
  for (const algorithm of ['astar', 'dijkstra', 'bfs']) assert.equal(solve(board, algorithm).cost, 7);
});

test('unreachable target returns no route for every algorithm', () => {
  const board = grid(3, 3, 0, 8, [1, 0, 1, 0, 0, 1, 1, 1, 1]);
  for (const algorithm of ['astar', 'dijkstra', 'bfs']) {
    const result = solve(board, algorithm); assert.equal(result.reached, false);
    assert.deepEqual(result.visitedOrder, [0]); assert.equal(result.steps, null); assertValidPath(board, result);
  }
});

test('movement neither wraps rows nor cuts diagonally through walls', () => {
  assert.deepEqual(neighbors(2, 3, 3), [5, 1]);
  assert.deepEqual(neighbors(3, 3, 3), [4, 6, 0]);
  const board = grid(3, 3, 0, 4, [1, 0, 1, 0, 1, 1, 1, 1, 1]);
  assert.equal(solve(board).reached, false);
});

test('weighted algorithms match independent Bellman-Ford oracle on 80 deterministic boards', () => {
  let state = 7331;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  for (let seed = 0; seed < 80; seed++) {
    const cells = Array.from({ length: 35 }, () => next() % 5 === 0 ? 0 : 1 + next() % 9);
    cells[0] = cells[34] = 1;
    const board = grid(7, 5, 0, 34, cells), expected = referenceCost(board);
    for (const algorithm of ['astar', 'dijkstra']) {
      const result = solve(board, algorithm);
      assert.equal(result.cost, expected, `${algorithm}, board ${seed}`); assertValidPath(board, result);
    }
    const bfs = solve(board, 'bfs'), unweighted = { ...board, cells: cells.map(c => c ? 1 : 0) };
    assert.equal(bfs.steps, referenceCost(unweighted)); assertValidPath(board, bfs);
  }
});

test('seeded maze is reproducible, connected and a tree; seeds change the maze', () => {
  const board = createMaze('portfolio');
  assert.deepEqual(board, createMaze('portfolio'));
  assert.notDeepEqual(board.cells, createMaze('different').cells);
  const open = board.cells.reduce((n, c) => n + (c > 0 ? 1 : 0), 0);
  let edges = 0;
  for (let i = 0; i < board.cells.length; i++) if (board.cells[i]) {
    edges += neighbors(i, board.width, board.height).filter(j => board.cells[j]).length;
  }
  const seen = new Set([board.start]), queue = [board.start];
  for (let head = 0; head < queue.length; head++) for (const n of neighbors(queue[head], board.width, board.height)) {
    if (board.cells[n] && !seen.has(n)) { seen.add(n); queue.push(n); }
  }
  assert.equal(seen.size, open); assert.equal(edges / 2, open - 1); assert.ok(solve(board).reached);
});

test('demo shows an actual weighted cost trade-off and deterministic traces', () => {
  const board = createDemo(), before = structuredClone(board);
  assert.ok(solve(board, 'bfs').cost > solve(board, 'astar').cost);
  assert.deepEqual(solve(board), solve(board)); assert.deepEqual(board, before);
});

test('import validation rejects broken schemas and returns a defensive copy', () => {
  const valid = grid(3, 3, 0, 8), copied = validateBoard(valid); copied.cells[1] = 9;
  assert.equal(valid.cells[1], 1);
  const invalid = [null, [], {}, { ...valid, version: 2 }, { ...valid, width: 3.5 }, { ...valid, width: 62 },
    { ...valid, height: 42 }, { ...valid, cells: [1] }, { ...valid, cells: [NaN, ...valid.cells.slice(1)] },
    { ...valid, cells: [-1, ...valid.cells.slice(1)] }, { ...valid, cells: [10, ...valid.cells.slice(1)] },
    { ...valid, start: 99 }, { ...valid, start: valid.goal }, { ...valid, cells: [0, ...valid.cells.slice(1)] }];
  for (const candidate of invalid) assert.throws(() => validateBoard(candidate));
  assert.throws(() => solve(valid, 'greedy')); assert.throws(() => createMaze('x', 30, 21));
});

test('maximum supported weighted board remains solvable', () => {
  const board = grid(61, 41, 0, 2500);
  assert.equal(solve(board, 'astar').cost, 100);
});
