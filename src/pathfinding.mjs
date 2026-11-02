export const ALGORITHMS = ['bfs', 'dijkstra', 'astar'];

export function validateBoard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The scenario must be a JSON object.');
  if (value.version !== 1) throw new Error('Unsupported scenario version; expected version 1.');
  const { width, height, cells, start, goal } = value;
  if (!Number.isInteger(width) || width < 3 || width > 61 || !Number.isInteger(height) || height < 3 || height > 41) {
    throw new Error('Grid dimensions must be integers: width 3–61 and height 3–41.');
  }
  if (!Array.isArray(cells) || cells.length !== width * height || !cells.every(c => Number.isInteger(c) && c >= 0 && c <= 9)) {
    throw new Error('Cells must contain exactly width × height integers from 0 (wall) to 9 (cost).');
  }
  if (![start, goal].every(i => Number.isInteger(i) && i >= 0 && i < cells.length && cells[i] > 0) || start === goal) {
    throw new Error('Start and target must be different, traversable cells inside the grid.');
  }
  return { version: 1, width, height, cells: [...cells], start, goal };
}

export function neighbors(index, width, height) {
  const x = index % width, y = Math.floor(index / width), result = [];
  // Stable tie order: east, south, west, north.
  if (x + 1 < width) result.push(index + 1);
  if (y + 1 < height) result.push(index + width);
  if (x > 0) result.push(index - 1);
  if (y > 0) result.push(index - width);
  return result;
}

class MinHeap {
  items = [];
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  before(a, b) { return a.priority < b.priority || (a.priority === b.priority && a.order < b.order); }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = l + 1;
        let best = i;
        if (l < a.length && this.before(a[l], a[best])) best = l;
        if (r < a.length && this.before(a[r], a[best])) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return first;
  }
  get size() { return this.items.length; }
}

/** Four-way movement. Entering a cell pays that cell's cost; the start is free. */
export function solve(input, algorithm = 'astar') {
  const board = validateBoard(input);
  if (!ALGORITHMS.includes(algorithm)) throw new Error('Unknown algorithm.');
  const { width, height, cells, start, goal } = board;
  const distance = Array(cells.length).fill(Infinity), previous = Array(cells.length).fill(-1);
  const closed = new Set(), visitedOrder = [], heap = new MinHeap();
  let order = 0, head = 0;
  const queue = [start];
  const heuristic = i => algorithm === 'astar'
    ? Math.abs(i % width - goal % width) + Math.abs(Math.floor(i / width) - Math.floor(goal / width)) : 0;
  distance[start] = 0;
  heap.push({ index: start, priority: heuristic(start), distance: 0, order: order++ });
  while (algorithm === 'bfs' ? head < queue.length : heap.size > 0) {
    let current;
    if (algorithm === 'bfs') current = queue[head++];
    else {
      const item = heap.pop();
      if (item.distance !== distance[item.index] || closed.has(item.index)) continue;
      current = item.index;
    }
    closed.add(current);
    visitedOrder.push(current);
    if (current === goal) break;
    for (const next of neighbors(current, width, height)) {
      if (cells[next] === 0 || closed.has(next)) continue;
      const candidate = distance[current] + (algorithm === 'bfs' ? 1 : cells[next]);
      if (candidate >= distance[next]) continue;
      distance[next] = candidate;
      previous[next] = current;
      if (algorithm === 'bfs') queue.push(next);
      else heap.push({ index: next, priority: candidate + heuristic(next), distance: candidate, order: order++ });
    }
  }
  const reached = closed.has(goal), path = [];
  if (reached) {
    let cursor = goal;
    while (cursor !== -1) { path.push(cursor); cursor = previous[cursor]; }
    path.reverse();
  }
  return {
    algorithm, reached, visitedOrder, path,
    cost: reached ? path.slice(1).reduce((sum, i) => sum + cells[i], 0) : null,
    steps: reached ? path.length - 1 : null,
  };
}

function randomFor(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createMaze(seed = 'copper-fox', width = 31, height = 21) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 5 || height < 5 || width > 61 || height > 41 || width % 2 === 0 || height % 2 === 0) {
    throw new Error('Maze dimensions must be odd integers: width 5–61 and height 5–41.');
  }
  const random = randomFor(seed), cells = Array(width * height).fill(0);
  const stack = [width + 1];
  cells[stack[0]] = 1;
  while (stack.length) {
    const current = stack.at(-1), x = current % width, y = Math.floor(current / width);
    const options = [[2, 0], [0, 2], [-2, 0], [0, -2]]
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && cells[ny * width + nx] === 0);
    if (!options.length) { stack.pop(); continue; }
    const [nx, ny] = options[Math.floor(random() * options.length)], next = ny * width + nx;
    cells[(current + next) / 2] = 1;
    cells[next] = 1;
    stack.push(next);
  }
  return validateBoard({ version: 1, width, height, cells, start: width + 1, goal: (height - 2) * width + width - 2 });
}

export function createDemo() {
  const width = 31, height = 21, cells = Array(width * height).fill(1);
  // Deliberate multiple routes: the shortest route crosses expensive terrain.
  for (let y = 7; y <= 13; y++) for (let x = 11; x <= 20; x++) cells[y * width + x] = 5;
  for (const [x, from, to] of [[7, 2, 8], [7, 12, 18], [24, 4, 10], [24, 14, 18]]) {
    for (let y = from; y <= to; y++) cells[y * width + x] = 0;
  }
  for (let x = 13; x <= 19; x++) cells[3 * width + x] = 0;
  return { version: 1, width, height, cells, start: 10 * width + 3, goal: 10 * width + 27 };
}
