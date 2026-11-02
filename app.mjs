import { solve, createDemo, createMaze, validateBoard } from './src/pathfinding.mjs';

const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d');
const names = { astar: 'A* search', dijkstra: 'Dijkstra', bfs: 'Breadth-first' };
const descriptions = {
  astar: 'Uses distance to the target to guide an optimal weighted search.',
  dijkstra: 'Expands the cheapest known route first. Always finds the lowest terrain cost.',
  bfs: 'Explores by number of moves. Ignores weights when choosing a route.',
};
const insights = {
  astar: 'A* balances the cost so far with an estimate of the distance left.',
  dijkstra: 'Dijkstra guarantees the cheapest route, even when a longer route costs less.',
  bfs: 'BFS finds the fewest moves. On weighted terrain that can be an expensive shortcut.',
};
let board = createDemo(), selectedTool = 'wall', cursor = board.start, drawing = false;
let result = null, position = 0, running = false, frame = 0, lastTime = 0;
let explored = new Set(), compared = false;
const unit = 30;

function status(message, isError = false) {
  $('status').textContent = message;
  $('status').parentElement.classList.toggle('error', isError);
}

function pause() {
  running = false;
  cancelAnimationFrame(frame);
  $('run').textContent = result && position < result.visitedOrder.length ? '▶ Resume' : '▶ Run search';
}

function emptyComparison() {
  compared = false;
  const body = $('comparison-body'); body.replaceChildren();
  for (const algorithm of ['astar', 'dijkstra', 'bfs']) {
    const row = document.createElement('tr');
    for (const text of [names[algorithm], '—', '—', '—', algorithm === 'bfs' ? 'Fewest moves' : 'Lowest weighted cost']) {
      const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
    }
    body.append(row);
  }
  $('comparison-note').textContent = 'Compare route cost, number of moves, and explored cells on the same terrain.';
}

function resetSearch(message = 'Search cleared. Your terrain is unchanged.', invalidateComparison = false) {
  pause(); result = null; position = 0; explored = new Set();
  $('run').textContent = '▶ Run search';
  $('cost').textContent = '—'; $('steps').textContent = '—'; $('explored').textContent = '0';
  if (invalidateComparison && compared) emptyComparison();
  status(message); draw();
}

function draw() {
  const { width, height, cells, start, goal } = board;
  if (canvas.width !== width * unit || canvas.height !== height * unit) {
    canvas.width = width * unit; canvas.height = height * unit;
  }
  ctx.fillStyle = '#101b15'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const complete = result && position >= result.visitedOrder.length;
  const path = new Set(complete ? result.path : []);
  for (let i = 0; i < cells.length; i++) {
    const x = (i % width) * unit, y = Math.floor(i / width) * unit;
    ctx.fillStyle = cells[i] === 0 ? '#64745f' : cells[i] > 1 ? '#644c2e' : '#14221a';
    if (explored.has(i)) ctx.fillStyle = cells[i] > 1 ? '#6b683a' : '#335341';
    if (path.has(i)) ctx.fillStyle = '#63783a';
    ctx.fillRect(x + 1, y + 1, unit - 2, unit - 2);
    if (cells[i] === 0) {
      ctx.fillStyle = '#788971'; ctx.fillRect(x + 4, y + 4, unit - 8, 2);
    } else if (cells[i] > 1 && i !== start && i !== goal) {
      ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = path.has(i) ? '#f2f5d3' : '#c7a978'; ctx.fillText(String(cells[i]), x + unit / 2, y + unit / 2);
    } else if (explored.has(i) && !path.has(i) && i !== start && i !== goal) {
      ctx.fillStyle = '#63836a'; ctx.beginPath(); ctx.arc(x + unit / 2, y + unit / 2, 2, 0, 2 * Math.PI); ctx.fill();
    }
  }
  if (complete && result.reached) {
    ctx.strokeStyle = '#d7ed86'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
    result.path.forEach((i, n) => {
      const x = (i % width + .5) * unit, y = (Math.floor(i / width) + .5) * unit;
      if (n === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  for (const [i, color, text] of [[start, '#91c5a3', 'S'], [goal, '#e3af84', 'T']]) {
    const x = (i % width) * unit, y = Math.floor(i / width) * unit;
    ctx.fillStyle = color; ctx.fillRect(x + 2, y + 2, unit - 4, unit - 4);
    ctx.fillStyle = '#17231a'; ctx.font = 'bold 14px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + unit / 2, y + unit / 2 + 1);
  }
  if (result && position > 0 && !complete) {
    const i = result.visitedOrder[position - 1];
    ctx.strokeStyle = '#d7ed86'; ctx.lineWidth = 2;
    ctx.strokeRect(i % width * unit + 3, Math.floor(i / width) * unit + 3, unit - 6, unit - 6);
  }
  if (document.activeElement === canvas) {
    ctx.strokeStyle = '#fff7de'; ctx.lineWidth = 2;
    ctx.strokeRect(cursor % width * unit + 1, Math.floor(cursor / width) * unit + 1, unit - 2, unit - 2);
  }
}

function loadBoard(next, label) {
  board = validateBoard(next); cursor = board.start;
  $('scenario-name').textContent = label; $('grid-size').textContent = `${board.width} × ${board.height}`;
  resetSearch('Terrain loaded. Run a search or edit the board.', true);
}

function paint(index) {
  const { start, goal } = board;
  if (selectedTool === 'start') {
    if (index === goal) return;
    board.start = index; board.cells[index] = 1;
  } else if (selectedTool === 'goal') {
    if (index === start) return;
    board.goal = index; board.cells[index] = 1;
  } else {
    if (index === start || index === goal) return;
    board.cells[index] = selectedTool === 'wall' ? 0 : selectedTool === 'weight' ? Number($('weight').value) : 1;
  }
  $('scenario-name').textContent = 'Your terrain';
  resetSearch('Terrain changed. Previous results were cleared.', true);
}

function pointerIndex(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(board.width - 1, Math.floor((event.clientX - rect.left) / rect.width * board.width)));
  const y = Math.max(0, Math.min(board.height - 1, Math.floor((event.clientY - rect.top) / rect.height * board.height)));
  return y * board.width + x;
}

function describeCursor() {
  const cost = board.cells[cursor];
  const description = `Column ${cursor % board.width + 1}, row ${Math.floor(cursor / board.width) + 1}: ${cost ? `cost ${cost}` : 'wall'}`;
  $('cursor-label').textContent = description;
  canvas.setAttribute('aria-label', `Editable grid. ${description}. Arrow keys move, Enter paints ${selectedTool}. Keys 1–5 select a tool.`);
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  drawing = true; canvas.setPointerCapture(event.pointerId); cursor = pointerIndex(event);
  paint(cursor); describeCursor();
});
canvas.addEventListener('pointermove', event => {
  const next = pointerIndex(event);
  if (next === cursor) return;
  cursor = next; describeCursor();
  if (drawing) paint(cursor); else draw();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { drawing = false; });
canvas.addEventListener('focus', draw); canvas.addEventListener('blur', draw);
canvas.addEventListener('keydown', event => {
  const x = cursor % board.width, y = Math.floor(cursor / board.width);
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'ArrowLeft' && x > 0) cursor--;
  if (event.key === 'ArrowRight' && x < board.width - 1) cursor++;
  if (event.key === 'ArrowUp' && y > 0) cursor -= board.width;
  if (event.key === 'ArrowDown' && y < board.height - 1) cursor += board.width;
  if (event.key === 'Enter' || event.key === ' ') paint(cursor);
  describeCursor(); draw();
});

function selectTool(tool) {
  selectedTool = tool;
  document.querySelectorAll('[data-tool]').forEach(button => {
    const active = button.dataset.tool === tool;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  describeCursor();
}
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => selectTool(button.dataset.tool)));
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  const tool = ['wall', 'weight', 'erase', 'start', 'goal'][Number(event.key) - 1];
  if (tool) { event.preventDefault(); selectTool(tool); }
});

function prepare() {
  if (!result || position >= result.visitedOrder.length) {
    resetSearch('Computing an expansion trace…');
    result = solve(board, $('algorithm').value);
  }
}

function advance(count) {
  const end = Math.min(position + count, result.visitedOrder.length);
  for (; position < end; position++) explored.add(result.visitedOrder[position]);
  $('explored').textContent = String(position);
  if (position === result.visitedOrder.length) {
    pause(); $('cost').textContent = result.cost ?? '∞'; $('steps').textContent = result.steps ?? '—';
    status(result.reached
      ? `${names[result.algorithm]} found a route: ${result.steps} moves, cost ${result.cost}. ${result.algorithm === 'bfs' ? 'BFS does not optimize weighted cost.' : 'This is an optimal weighted route.'}`
      : `${names[result.algorithm]} explored ${position} cells. The target is unreachable.`);
  } else status(`Replaying ${names[result.algorithm]}: ${position} explored cells. Pause or step to inspect.`);
  draw();
}

function tick(now) {
  if (!running) return;
  if (now - lastTime >= 45) { lastTime = now; advance(Number($('speed').value)); }
  if (running) frame = requestAnimationFrame(tick);
}

$('run').addEventListener('click', () => {
  if (running) { pause(); status(`Paused after ${position} cells. Step through or resume.`); return; }
  prepare(); running = true; lastTime = 0; $('run').textContent = 'Ⅱ Pause'; frame = requestAnimationFrame(tick);
});
$('step').addEventListener('click', () => { pause(); prepare(); advance(1); });
$('reset').addEventListener('click', () => resetSearch());
$('algorithm').addEventListener('change', () => {
  $('algorithm-note').textContent = descriptions[$('algorithm').value];
  $('insight').textContent = insights[$('algorithm').value];
  resetSearch('Algorithm changed. Your board is ready.');
});
$('weight').addEventListener('input', () => { $('weight-value').textContent = $('weight').value; });
$('speed').addEventListener('input', () => { $('speed-value').textContent = `${$('speed').value}×`; });
$('demo').addEventListener('click', () => loadBoard(createDemo(), 'The expensive shortcut'));
$('clear').addEventListener('click', () => loadBoard({ ...board, cells: board.cells.map(() => 1) }, 'A clean slate'));
$('maze').addEventListener('click', () => {
  const seed = $('seed').value.trim() || 'copper-fox'; $('seed').value = seed;
  loadBoard(createMaze(seed), `Maze / ${seed}`);
});
$('seed').addEventListener('keydown', event => { if (event.key === 'Enter') $('maze').click(); });
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(validateBoard(board), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'routelab-scenario.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Scenario exported. Import this file to reproduce the same terrain and endpoints.');
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 100_000) throw new Error('Scenario file is too large. Maximum size: 100 KB.');
    const next = validateBoard(JSON.parse(await file.text()));
    loadBoard(next, 'Imported scenario');
  } catch (error) { status(`Import rejected: ${error.message}`, true); }
  finally { event.target.value = ''; }
});
$('compare').addEventListener('click', () => {
  const results = ['astar', 'dijkstra', 'bfs'].map(a => solve(board, a));
  const best = Math.min(...results.filter(r => r.reached).map(r => r.cost));
  const body = $('comparison-body'); body.replaceChildren();
  for (const value of results) {
    const row = document.createElement('tr');
    const columns = [names[value.algorithm], value.cost ?? 'No route', value.steps ?? '—', value.visitedOrder.length, value.algorithm === 'bfs' ? 'Fewest moves' : 'Lowest weighted cost'];
    columns.forEach((text, i) => {
      const cell = document.createElement('td'); cell.textContent = String(text);
      if (i === 1 && value.cost === best) cell.classList.add('best'); row.append(cell);
    });
    body.append(row);
  }
  compared = true;
  $('comparison-note').textContent = 'Computed on the current board. Explored count includes start and target. Editing the terrain clears this comparison.';
  status('Comparison ready below the grid. All three algorithms used the same board.');
});

draw();
