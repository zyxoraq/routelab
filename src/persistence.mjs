import { validateBoard } from './pathfinding.mjs';

export const STORAGE_KEY = 'routelab.scenario.v1';

/** Access storage inside try/catch: even the localStorage getter can throw. */
export function createScenarioStorage(getStorage = () => globalThis.localStorage) {
  return {
    load() {
      let raw;
      try { raw = getStorage().getItem(STORAGE_KEY); }
      catch { return { status: 'unavailable' }; }
      if (raw === null) return { status: 'empty' };
      try {
        if (raw.length > 100_000) throw new Error('Saved scenario exceeds the size limit.');
        return { status: 'restored', board: validateBoard(JSON.parse(raw)) };
      } catch { return { status: 'corrupt' }; }
    },
    save(board) {
      // Reject invalid application data without overwriting a valid saved scenario.
      const serialized = JSON.stringify(validateBoard(board));
      try { getStorage().setItem(STORAGE_KEY, serialized); return { status: 'saved' }; }
      catch { return { status: 'unavailable' }; }
    },
    clear() {
      try { getStorage().removeItem(STORAGE_KEY); return { status: 'cleared' }; }
      catch { return { status: 'unavailable' }; }
    },
  };
}
