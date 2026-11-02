import { validateBoard } from './pathfinding.mjs';

export function sameBoard(a, b) {
  return a.width === b.width && a.height === b.height && a.start === b.start && a.goal === b.goal
    && a.cells.length === b.cells.length && a.cells.every((cell, index) => cell === b.cells[index]);
}

/** Up to `limit` transitions, plus the current board and one active stroke baseline. */
export class BoardHistory {
  #limit;
  #present;
  #past = [];
  #future = [];
  #baseline = null;

  constructor(initial, limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('History limit must be an integer from 1 to 100.');
    this.#limit = limit;
    this.#present = validateBoard(initial);
  }

  get current() { return validateBoard(this.#present); }
  get canUndo() { return this.#past.length > 0 || (this.#baseline !== null && !sameBoard(this.#baseline, this.#present)); }
  get canRedo() { return this.#future.length > 0 && (this.#baseline === null || sameBoard(this.#baseline, this.#present)); }
  get undoCount() { return this.#past.length; }
  get redoCount() { return this.#future.length; }

  #remember(board) {
    this.#past.push(board);
    if (this.#past.length > this.#limit) this.#past.shift();
    this.#future = [];
  }

  begin() {
    if (this.#baseline === null) this.#baseline = this.#present;
  }

  replace(board) {
    const next = validateBoard(board);
    if (sameBoard(next, this.#present)) return false;
    if (this.#baseline === null) this.#remember(this.#present);
    this.#present = next;
    return true;
  }

  /** A stroke that returns to its baseline is a no-op and preserves the redo branch. */
  end() {
    if (this.#baseline === null) return false;
    const baseline = this.#baseline;
    this.#baseline = null;
    if (sameBoard(baseline, this.#present)) return false;
    this.#remember(baseline);
    return true;
  }

  undo() {
    this.end();
    if (!this.#past.length) return null;
    this.#future.push(this.#present);
    this.#present = this.#past.pop();
    return this.current;
  }

  redo() {
    this.end();
    if (!this.#future.length) return null;
    this.#past.push(this.#present);
    this.#present = this.#future.pop();
    return this.current;
  }
}
