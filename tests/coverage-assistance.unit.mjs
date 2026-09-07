import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCoverageAssistance } from '../coverage-assistance.js';

const players = [
  { id: 'g1', team: 'green' }, { id: 'g2', team: 'green' },
  { id: 'o1', team: 'orange' }, { id: 'o2', team: 'orange' }
];
const positions = () => ({
  g1: { x: 4, y: 9 }, g2: { x: 16, y: 8 },
  o1: { x: 3, y: 35 }, o2: { x: 17, y: 34 }
});
const makeInputs = ({ auto = true, guides = true, team = 'both', pin = null } = {}) => {
  const play = { id: 'coverage', steps: [
    { id: 's1', positions: positions(), shot: { playerId: 'g1', from: { x: 3, y: 9 }, to: { x: 18, y: 37 } } },
    { id: 's2', positions: positions(), shot: { playerId: 'o1', from: { x: 4, y: 35 }, to: { x: 2, y: 5 } } },
    { id: 's3', positions: positions(), shot: { playerId: 'g1', from: { x: 5, y: 9 }, to: { x: 17, y: 37 } } }
  ] };
  const document = { players, assistance: { autoShading: auto, showCoverageGuides: guides, team }, shots: [
    { id: 's1', movement: pin ? { playerId: pin, pinned: true } : undefined }, { id: 's2' }, { id: 's3' }
  ] };
  const timeline = { segments: play.steps.map((step, index) => ({ index, step: { id: step.id }, duration: 0.25 })) };
  return { play, document, timeline };
};

test('default-off assistance clones the play without changing derived positions', () => {
  const inputs = makeInputs({ auto: false, guides: false });
  const result = applyCoverageAssistance(inputs.play, { players, shots: [] }, inputs.timeline);
  assert.deepEqual(result.play, inputs.play);
  assert.notEqual(result.play, inputs.play);
  assert.deepEqual(result.coverage, []);
});

test('coverage guides never enable movement and identify guide-only suggestions', () => {
  const inputs = makeInputs({ auto: false, guides: true });
  Object.freeze(inputs.play);
  const result = applyCoverageAssistance(inputs.play, inputs.document, inputs.timeline);
  assert.deepEqual(result.play, inputs.play);
  assert(result.coverage.length > 0);
  assert(result.coverage.every(item => item.explanation.includes('Guide only')));
});

test('current-leg suggestions use contact origin and ignore the future authored target', () => {
  const first = makeInputs({ auto: false, guides: true });
  const changed = makeInputs({ auto: false, guides: true });
  changed.play.steps[1].shot.to = { x: 19, y: 3 };
  const a = applyCoverageAssistance(first.play, first.document, first.timeline).coverage[0];
  const b = applyCoverageAssistance(changed.play, changed.document, changed.timeline).coverage[0];
  assert.deepEqual(a, b);
  assert.deepEqual(a.threat, first.play.steps[0].shot.from);
});

test('auto shading preserves receiver, hitter, manual pins, depth, and all shot facts', () => {
  const inputs = makeInputs({ pin: 'o2' });
  const original = structuredClone(inputs.play);
  const result = applyCoverageAssistance(inputs.play, inputs.document, inputs.timeline);
  assert.deepEqual(inputs.play, original);
  assert.deepEqual(result.play.steps[0].positions, original.steps[0].positions);
  for (let index = 0; index < result.play.steps.length; index += 1) {
    assert.deepEqual(result.play.steps[index].shot, original.steps[index].shot);
    for (const id of Object.keys(original.steps[index].positions)) {
      assert.equal(result.play.steps[index].positions[id].y, original.steps[index].positions[id].y);
    }
  }
  assert(result.coverage[0].explanation.includes('Preserved o1, o2'));
});

test('applies selected-team movement in both team directions without hitter swaps', () => {
  const inputs = makeInputs();
  const result = applyCoverageAssistance(inputs.play, inputs.document, inputs.timeline);
  assert.equal(result.play.steps[0].shot.playerId, 'g1');
  assert.equal(result.play.steps[1].shot.playerId, 'o1');
  assert.notEqual(result.play.steps[0].positions.o2.x, inputs.play.steps[0].positions.o2.x);
  assert.notEqual(result.play.steps[1].positions.g2.x, inputs.play.steps[1].positions.g2.x);

  const greenOnly = makeInputs({ team: 'green' });
  const selected = applyCoverageAssistance(greenOnly.play, greenOnly.document, greenOnly.timeline);
  assert.deepEqual(selected.play.steps[0].positions, greenOnly.play.steps[0].positions);
  assert.notEqual(selected.play.steps[1].positions.g2.x, greenOnly.play.steps[1].positions.g2.x);
  assert(selected.coverage.every(item => item.team === 'green'));
});

test('bounds lateral travel by duration and court limits deterministically', () => {
  const inputs = makeInputs();
  inputs.play.steps[0].positions.o2.x = 19;
  inputs.timeline.segments[0].duration = 0.05;
  const first = applyCoverageAssistance(inputs.play, inputs.document, inputs.timeline);
  const second = applyCoverageAssistance(inputs.play, inputs.document, inputs.timeline);
  const moved = first.play.steps[0].positions.o2.x;
  assert(moved >= 1 && moved <= 19);
  assert(Math.abs(moved - 19) <= 13 * 0.05 + Number.EPSILON);
  assert.deepEqual(first, second);
});
