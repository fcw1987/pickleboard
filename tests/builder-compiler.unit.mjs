import test from 'node:test';
import assert from 'node:assert/strict';
import { PICKLEBOARD_PLAYS } from '../play-catalog.js';
import { samplePlayBall } from '../three-d-core.js';
import { validateRallyRules } from '../rally-rules.js';
import { MAX_SHOTS, SCHEMA_VERSION, createStarterDocument, documentFromTemplate, validateDocument } from '../play-document.js';
import { compileDocument } from '../play-compiler.js';

const clone = value => structuredClone(value);

test('starter is a valid versioned three-shot source document', () => {
  const document = createStarterDocument();
  assert.equal(document.schemaVersion, SCHEMA_VERSION);
  assert.equal(document.shots.length, 3);
  assert.equal(validateDocument(document), document);
  assert.deepEqual(document.shots.map(shot => shot.family), ['serve', 'return', 'drop']);
});

test('validation rejects malformed, unbounded, duplicate, and non-finite authoring input', () => {
  const base = createStarterDocument();
  assert.throws(() => validateDocument({ ...base, schemaVersion: 99 }), /schemaVersion must be 1/);
  assert.throws(() => validateDocument({ ...base, title: '<b>'.repeat(100) }), /at most 120/);
  assert.throws(() => validateDocument({ ...base, shots: Array.from({ length: MAX_SHOTS + 1 }, () => base.shots[0]) }), /at most 64/);
  const duplicate = clone(base); duplicate.shots[1].id = duplicate.shots[0].id;
  assert.throws(() => validateDocument(duplicate), /must be unique/);
  const nan = clone(base); nan.shots[1].target.x = NaN;
  assert.throws(() => validateDocument(nan), /non-finite|finite x and y/);
  const manual = clone(base); manual.shots[1].movement = { intent: 'manual', pinned: true };
  assert.throws(() => validateDocument(manual), /target is required/);
});

test('custom recipes compile through production steps and timeline with stable recipe event ids', () => {
  const document = createStarterDocument();
  const result = compileDocument(document);
  assert.equal(result.validShotCount, 3);
  assert.deepEqual(result.findings, []);
  assert.equal(result.play.steps.length, 4);
  assert.deepEqual(result.play.steps[0].positions, document.initialLayout);
  assert.equal(result.play.steps[1].shot.authoring.recipeId, 'serve-1');
  assert.deepEqual(result.play.steps[1].shot.intendedTarget, document.shots[0].target);
  assert.ok(result.timeline.events.every(event => event.id.includes(document.shots[event.rallyLeg - 1].id)));
  assert.deepEqual(result.timeline.segments.filter(segment => segment.trajectory).map(segment => segment.trajectory.bounces), [1, 1, 1]);
  assert.deepEqual(validateRallyRules(result.play, result.timeline).violations, []);
});

test('serve placement and a drive/drop choice produce genuinely different deterministic timelines', () => {
  const base = createStarterDocument();
  const shifted = clone(base);
  shifted.shots[0].target = { x: 7.25, y: 35.5 };
  shifted.shots[2] = { ...shifted.shots[2], family: 'drive', id: 'drive-3', arc: 'low', pace: 'firm', target: { x: 14.5, y: 32 } };
  const first = compileDocument(shifted), second = compileDocument(clone(shifted));
  assert.equal(first.validShotCount, 3);
  assert.deepEqual(first.play, second.play);
  assert.deepEqual(first.timeline.events, second.timeline.events);
  assert.deepEqual(first.play.steps[1].shot.to, { x: 7.25, y: 35.5 });
  assert.equal(first.play.steps[3].shot.type, 'drive');
  assert.equal(first.play.steps[3].shot.flight.speedMph, 40);
  assert.notEqual(first.timeline.duration, compileDocument(base).timeline.duration);
});

test('all supported shot families compile as intent rather than a lesson selector', () => {
  const families = ['serve', 'return', 'drive', 'drop', 'dink', 'volley', 'reset', 'lob', 'overhead'];
  for (const family of families) {
    const document = createStarterDocument();
    document.id = `custom-${family}`;
    document.opening = family === 'serve' ? 'serve' : 'midrally';
    document.initialLayout.ball = family === 'serve' ? { x: 16.2, y: 0 } : { x: 7, y: 14 };
    document.initialLayout.player1 = family === 'serve' ? { x: 15, y: -1 } : { x: 7, y: 14 };
    document.shots = [{
      id: `${family}-recipe`, family, hitter: 'player1', receiver: 'auto',
      contactStyle: family === 'reset' ? 'short-hop' : 'forehand', target: { x: 7, y: family === 'serve' ? 38 : 32 },
      arc: family === 'drive' ? 'low' : family === 'lob' ? 'high' : 'medium', pace: family === 'drop' ? 'soft' : 'medium',
      movement: { intent: 'hold', pinned: false }, ...(family === 'serve' ? { serveMethod: 'drop' } : {})
    }];
    const result = compileDocument(document);
    assert.equal(result.validShotCount, 1, `${family}: ${result.findings.map(item => item.message).join('; ')}`);
    assert.equal(result.play.steps[1].shot.authoring.family, family);
  }
});

test('rule violations and feasibility failures are distinct and preserve a playable prefix', () => {
  const wrongTeam = createStarterDocument();
  wrongTeam.shots[1].hitter = 'player2';
  const rule = compileDocument(wrongTeam);
  assert.equal(rule.validShotCount, 1);
  assert.equal(rule.findings[0].kind, 'rule');
  assert.equal(rule.findings[0].shotId, 'return-2');
  assert.ok(rule.timeline.duration > 0);

  const unreachable = createStarterDocument();
  unreachable.opening = 'midrally';
  unreachable.initialLayout.ball = { x: 1, y: 14 };
  unreachable.initialLayout.player1 = { x: 19, y: 40 };
  unreachable.shots = [{ ...unreachable.shots[2], id: 'unreachable', hitter: 'player1', target: { x: 2, y: 32 } }];
  const feasible = compileDocument(unreachable);
  assert.equal(feasible.validShotCount, 0);
  assert.equal(feasible.findings[0].kind, 'feasibility');
  assert.equal(feasible.timeline.duration, 0);
});

test('intentional fault remains visible and terminates without an invented continuation', () => {
  const document = createStarterDocument();
  document.intentionalFault = true;
  document.ending = 'fault';
  document.shots[0].target = { x: 15, y: 38 };
  const result = compileDocument(document);
  assert.equal(result.validShotCount, 1);
  assert.equal(result.findings[0].kind, 'rule');
  assert.equal(result.findings[0].severity, 'warning');
  assert.equal(result.play.steps.length, 2);
});

test('opening sequence protects the two-bounce rule and treats the kitchen line as a serve fault', () => {
  const kitchenLine = createStarterDocument();
  kitchenLine.shots[0].target = { x: 5, y: 29 };
  const serveFault = compileDocument(kitchenLine);
  assert.equal(serveFault.validShotCount, 0);
  assert.match(serveFault.findings[0].message, /beyond the non-volley-zone line/);

  const volleyReturn = createStarterDocument();
  volleyReturn.shots[1] = { ...volleyReturn.shots[1], family: 'volley', contactStyle: 'forehand' };
  const returnFault = compileDocument(volleyReturn);
  assert.equal(returnFault.validShotCount, 1);
  assert.match(returnFault.findings.find(item => /receiving team/.test(item.message)).message, /let the serve bounce/);
  assert.deepEqual(returnFault.play.steps[1].shot.to, volleyReturn.shots[0].target,
    'the playable prefix must not retain an interception derived from the rejected recipe');
  assert.equal(returnFault.play.steps[1].shot.flight.bounces, 1);
});

test('compiler does not mutate source targets, manual movement, or pins', () => {
  const document = createStarterDocument();
  document.shots[2].movement = { intent: 'manual', pinned: true, target: { x: 12, y: 12 }, waypoints: [{ x: 13, y: 8 }] };
  const before = clone(document);
  Object.freeze(document.shots[2].movement);
  Object.freeze(document.shots[2]);
  compileDocument(document);
  assert.deepEqual(document, before);
  assert.deepEqual(document.shots[2].movement, before.shots[2].movement);
});

test('all eight templates preserve approved timing, positions, contacts, and bounce semantics exactly', () => {
  assert.equal(PICKLEBOARD_PLAYS.length, 8);
  for (const source of PICKLEBOARD_PLAYS) {
    const document = documentFromTemplate(source);
    const result = compileDocument(document);
    assert.equal(result.validShotCount, source.steps.filter(step => step.shot).length, source.id);
    assert.deepEqual(result.play.steps, source.steps, source.id);
    const sourceResult = compileDocument(documentFromTemplate(source));
    assert.equal(result.timeline.duration, sourceResult.timeline.duration, source.id);
    assert.deepEqual(result.timeline.segments.map(segment => segment.step.positions), sourceResult.timeline.segments.map(segment => segment.step.positions), source.id);
  }
});

test('editing a template recipe leaves the exact-source path and recompiles authored intent', () => {
  const source = PICKLEBOARD_PLAYS.find(play => play.id === 'third-shot-drop');
  const document = documentFromTemplate(source);
  document.shots[2].target = { x: 11.25, y: 28.5 };
  document.shots[2].family = 'drive';
  document.shots[2].arc = 'low';
  document.shots[2].pace = 'firm';
  const result = compileDocument(document);
  assert.equal(result.validShotCount, 3);
  assert.deepEqual(result.play.steps[3].shot.intendedTarget, { x: 11.25, y: 28.5 });
  assert.equal(result.play.steps[3].shot.type, 'drive');
  assert.notDeepEqual(result.play.steps, source.steps);
});

test('one sampled ball remains continuous at every generated event boundary', () => {
  const timeline = compileDocument(createStarterDocument()).timeline;
  for (const event of timeline.events) {
    const before = samplePlayBall(timeline, Math.max(0, event.time - 1e-7));
    const at = samplePlayBall(timeline, event.time);
    const after = samplePlayBall(timeline, Math.min(timeline.duration, event.time + 1e-7));
    assert.ok(Math.hypot(before.x - at.x, before.y - at.y, before.z - at.z) < 2e-5, event.id);
    assert.ok(Math.hypot(after.x - at.x, after.y - at.y, after.z - at.z) < 2e-5, event.id);
  }
  assert.equal(new Set(timeline.events.map(event => event.id)).size, timeline.events.length);
});
