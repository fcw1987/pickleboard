import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DraftStore,
  EditHistory,
  MAX_DRAFTS,
  MAX_JSON_BYTES,
  STORAGE_KEY
} from '../builder-storage.js';

const document = (id = 'draft-1', overrides = {}) => ({
  id,
  title: `Play ${id}`,
  schemaVersion: 1,
  shots: [],
  ...overrides
});

const validate = value => {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.shots) || value.shots.length > 64) {
    throw new Error('invalid play document');
  }
};

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('round trips version-one source drafts, selection, listing, and removal', () => {
  const storage = new MemoryStorage();
  const store = new DraftStore({ storage, validate });
  store.save(document('one'));
  store.save(document('two', { title: 'Second', incomplete: true }));
  assert.deepEqual(store.list(), [{ id: 'one', title: 'Play one' }, { id: 'two', title: 'Second' }]);
  assert.equal(store.loadLast().id, 'two');
  assert.equal(store.open('one').id, 'one');
  assert.equal(store.loadLast().id, 'one');
  assert.equal(store.remove('one'), true);
  assert.equal(store.loadLast().id, 'two');
  assert.equal(store.remove('missing'), false);
});

test('returns detached documents and exports/imports validated JSON', () => {
  const store = new DraftStore({ storage: new MemoryStorage(), validate });
  const source = document('one', { shots: [{ id: 'shot-1', target: { x: 1, y: 2 } }] });
  store.save(source);
  source.shots[0].target.x = 99;
  const opened = store.open('one');
  assert.equal(opened.shots[0].target.x, 1);
  opened.shots[0].target.x = 88;
  assert.equal(store.open('one').shots[0].target.x, 1);
  assert.deepEqual(store.importJSON(store.exportJSON(source)), source);
});

test('rejects malformed, oversized, future-version, non-finite, and prototype-key imports', () => {
  const store = new DraftStore({ storage: new MemoryStorage(), validate });
  assert.throws(() => store.importJSON('{bad'), /malformed JSON/);
  assert.throws(() => store.importJSON(`{"id":"x","title":"${'x'.repeat(MAX_JSON_BYTES)}"}`), /512 KiB/);
  assert.throws(() => store.importJSON(JSON.stringify(document('future', { schemaVersion: 2 }))), /invalid play document/);
  assert.throws(() => store.importJSON('{"id":"x","title":"x","schemaVersion":1,"shots":[],"__proto__":{}}'), /blocked key/);
  assert.throws(() => store.save(document('nan', { coordinate: Number.NaN })), /finite number/);
});

test('preserves corrupt and unsupported stored bytes for recovery', () => {
  for (const bytes of ['{broken', JSON.stringify({ schemaVersion: 2, drafts: [], lastId: null })]) {
    const storage = new MemoryStorage({ [STORAGE_KEY]: bytes });
    const store = new DraftStore({ storage, validate });
    assert.throws(() => store.loadLast(), /malformed|unsupported/);
    assert.equal(storage.getItem(STORAGE_KEY), bytes);
  }
});

test('quota failure cannot overwrite the previously committed library', () => {
  const storage = new MemoryStorage();
  const store = new DraftStore({ storage, validate });
  store.save(document('safe'));
  const prior = storage.getItem(STORAGE_KEY);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => store.save(document('new')), /previous saved library was kept/);
  assert.equal(storage.getItem(STORAGE_KEY), prior);
});

test('enforces the library bound without changing saved data', () => {
  const storage = new MemoryStorage();
  const store = new DraftStore({ storage, validate });
  for (let index = 0; index < MAX_DRAFTS; index += 1) store.save(document(`d${index}`));
  const prior = storage.getItem(STORAGE_KEY);
  assert.throws(() => store.save(document('overflow')), /limited to 50/);
  assert.equal(storage.getItem(STORAGE_KEY), prior);
});

test('uses a dedicated key and leaves the legacy theme and service-worker-like entries alone', () => {
  const storage = new MemoryStorage({
    'pickleboard-theme': 'dark',
    'pickleboard-static-v16': 'cache sentinel'
  });
  new DraftStore({ storage, validate }).save(document());
  assert.equal(storage.getItem('pickleboard-theme'), 'dark');
  assert.equal(storage.getItem('pickleboard-static-v16'), 'cache sentinel');
  assert(storage.getItem(STORAGE_KEY));
});

test('edit history isolates snapshots, truncates redo, and honors its limit', () => {
  const initial = document('history', { shots: [{ id: 'a' }] });
  const history = new EditHistory(initial, { limit: 2 });
  initial.shots.push({ id: 'external' });
  assert.deepEqual(history.current.shots, [{ id: 'a' }]);
  history.commit(document('history', { shots: [{ id: 'b' }] }));
  const returned = history.undo();
  returned.shots[0].id = 'mutated';
  assert.equal(history.current.shots[0].id, 'a');
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);
  history.commit(document('history', { shots: [{ id: 'c' }] }));
  assert.equal(history.canRedo, false);
  history.commit(document('history', { shots: [{ id: 'd' }] }));
  history.commit(document('history', { shots: [{ id: 'e' }] }));
  assert.equal(history.undo().shots[0].id, 'd');
  assert.equal(history.undo().shots[0].id, 'c');
  assert.equal(history.canUndo, false);
});
