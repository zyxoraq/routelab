# RouteLab

![RouteLab — pathfinding laboratory](docs/cover.svg)

**A shorter route is not always a cheaper route.** RouteLab makes that trade-off visible: paint a weighted grid, run BFS, Dijkstra or A*, replay their explored cells, and compare the actual results on the same terrain.

Dependency-free JavaScript · Canvas · deterministic scenarios · Node.js test runner · MIT

## Run in 30 seconds

Install **Node.js 24 or newer**, then run from this directory:

```sh
node server.mjs
```

Open **http://127.0.0.1:4313**. No installation command, account, API key or internet connection is required after Node is installed. `npm start` is an optional equivalent if npm is available. The server binds only to your own computer. Set the `PORT` environment variable to change its port.

```sh
node --test
```

This runs the algorithm and HTTP server tests. GitHub Actions runs the same command on Windows and Ubuntu with Node 24. CI configuration is provided; a green hosted run is not implied until GitHub runs it.

## Try the trade-off

1. Open the included **expensive shortcut** scenario. The central cells cost 5 to enter; ordinary ground costs 1.
2. Click **Compare all three**. BFS takes a short route through the expensive middle; Dijkstra and A* can find a cheaper detour.
3. Select **Breadth-first search**, click **Run search**, then **Pause** and **Step** to inspect each explored cell.
4. Select **Weight**, change the terrain cost, and paint. Change endpoints with **Start** and **Target**. Edits invalidate previous results.
5. Enter a seed such as `copper-fox` and generate a maze. The same seed always generates the same 31 × 21 maze.
6. Export JSON, change the board, then import the file to restore its exact cells and endpoints.

**Keyboard:** tab to the grid, use arrow keys to move the cursor and Enter/Space to paint. Keys 1–5 select wall, weight, erase, start and target. There is also mouse/touch drag painting. Board state is kept in memory; export before closing the tab if you want to keep it.

## What the numbers mean

| Algorithm | Optimizes | Implementation | Main trade-off |
|---|---|---|---|
| BFS | Number of moves | FIFO queue, indexed head | Ignores terrain weights when selecting a path |
| Dijkstra | Total entered cell cost | Binary min-heap | Explores by known cost without direction guidance |
| A* | Total entered cell cost | Binary min-heap + Manhattan distance | Uses an admissible, consistent heuristic for this grid |

Movement is four-directional. A wall is 0; traversable cells have integer costs 1–9. **Entering a cell pays its cost; the starting cell is free.** The reported cost always sums actual weights, including for BFS. The target is not allowed to equal the start.

Explored cells are unique cells removed from the frontier, including the start and, when reached, the target. A* is not claimed to explore fewer cells on every board. Equal priorities use stable insertion order, with neighbors considered east, south, west, north. Equal-cost paths need not have equal lengths. An unreachable target is reported explicitly.

**Replay is an explanation, not a timing benchmark.** A small board is solved synchronously, producing an expansion trace; animation and Step replay that trace. Replay speed means cells per animation interval, not computation speed. The comparison computes each algorithm on the same current board and does not invent latency or performance claims.

## Architecture

```text
index.html + styles.css    Responsive interface and accessible controls
app.mjs                   Editor state, canvas renderer, trace replay, import/export
src/pathfinding.mjs       Pure algorithms, schema validation, deterministic maze generator
server.mjs                Tiny localhost HTTP server with an explicit asset allowlist
test/                     Algorithm oracle, invariants and HTTP boundary tests
```

The algorithm module has no DOM or Node-specific dependencies, so the browser and tests use the same implementation. Dijkstra and A* use a binary heap and ignore obsolete heap entries. BFS uses an array with a moving head instead of repeatedly shifting it. The maze uses a seeded PRNG and an iterative randomized depth-first search; it produces a connected tree of passages.

On a grid, BFS is `O(V + E)` and weighted search is `O((V + E) log V)` in the usual binary-heap bound, with `E = O(V)` here. Trace and board storage are `O(V)`. JSON imports are copied and validated before replacing the active board. The server permits only four frontend files, rejects unsupported methods, does not expose the working directory, and sets a restrictive Content Security Policy.

## Scenario format

```json
{
  "version": 1,
  "width": 3,
  "height": 3,
  "cells": [1, 1, 1, 0, 5, 1, 1, 1, 1],
  "start": 0,
  "goal": 8
}
```

Cells use row-major indexing: `index = row * width + column`. Imports support width 3–61 and height 3–41, require exactly `width * height` valid cells, and reject invalid/walled endpoints. The file input has a 100 KB limit. Unknown metadata is discarded. Export preserves the board, not the current replay, selected brush or seed label.

## Verification and limits

Tests compare Dijkstra and A* against an independent exhaustive edge-relaxation oracle on 80 deterministic weighted/blocked grids. They also check BFS's unweighted optimum, route adjacency, no diagonal or row-wrap movement, unreachable targets, target entry costs, deterministic traces, maze connectivity/tree structure, schema rejection, maximum dimensions, and server path/method boundaries.

This is an educational algorithm tool, not a navigation service. It has no real maps, diagonal movement, live traffic, multi-agent planning, persistent accounts or cloud backend. Search runs on the main thread and input is intentionally capped at 2,501 cells. Canvas rendering is not a semantic table; keyboard painting and control labels are provided, but full screen-reader exploration of every cell would need a dedicated alternative view. Browser automation and visual screenshot verification are not part of the Node test suite.

## Topics to explain in an interview

- Why BFS is optimal on unweighted graphs, and why the same guarantee does not cover weighted cost.
- Why Manhattan distance is admissible and consistent with four-way movement and costs of at least 1.
- Why a heap can contain stale entries, and why skipping them is correct.
- Why deterministic tie-breaking and seeded scenarios help reproduce bugs.
- Why animation duration does not measure algorithm runtime.
- How the test oracle differs from the production algorithms.
- How a Web Worker and an incremental event stream could support larger boards.

## По-русски

**RouteLab — интерактивная лаборатория поиска пути.** Можно рисовать стены и дорогие участки, менять начало и цель, сравнивать BFS, Дейкстру и A*, пошагово просматривать поиск и сохранять сценарии в JSON.

Запуск: установите Node.js 24+, откройте терминал в папке проекта и выполните `node server.mjs`. Затем перейдите на **http://127.0.0.1:4313**. Проверки запускаются командой `node --test`. Сторонние пакеты и платные сервисы не нужны.

**Сценарий демонстрации:** откройте начальную карту и нажмите Compare all three. BFS выбирает минимальное число шагов через дорогие клетки. Дейкстра и A* минимизируют сумму стоимости входа в клетки. Затем нарисуйте препятствие, повторите сравнение и объясните изменение результатов. Вес стартовой клетки не оплачивается; стоимость целевой клетки учитывается.

**Важное ограничение:** Step показывает запись уже вычисленного порядка обхода. Скорость анимации не является скоростью алгоритма. Размер импортируемой карты ограничен 61 × 41; поиск выполняется в основном потоке браузера. Данные не сохраняются после закрытия страницы — используйте экспорт.

**Формулировка для раздела «Учебные проекты»:** «RouteLab — визуальная лаборатория поиска пути: BFS, Дейкстра и A*, взвешенные сетки, воспроизводимые сценарии, Canvas-интерфейс и автоматическая проверка оптимальности на независимом алгоритме». Перед собеседованием разберите модуль `src/pathfinding.mjs` и вопросы выше, чтобы уверенно объяснять решения и собственные доработки.

## License

[MIT](LICENSE), © 2026 zyxoraq.
