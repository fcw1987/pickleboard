import test from 'node:test';
import assert from 'node:assert/strict';
import { POSE_LIBRARY, REQUIRED_POSES, dominantAliases, sampleStrokePose } from '../three-d-animation.js';
import { STROKE_PROFILES, compilePlayTimeline, resolveShotSemantics } from '../three-d-core.js';

test('required authored pose vocabulary exists', () => {
  for (const name of REQUIRED_POSES) assert.ok(POSE_LIBRARY[name], `missing pose ${name}`);
});

test('dominant side maps semantic roles without mirroring player root', () => {
  assert.equal(dominantAliases('right').dominantArm, 'RightArm');
  assert.equal(dominantAliases('right').dominantHand, 'RightHand');
  assert.equal(dominantAliases('left').dominantArm, 'LeftArm');
  assert.equal(dominantAliases('left').dominantHand, 'LeftHand');
});

test('stroke samples contain preparation, contact, follow-through, and recovery', () => {
  const profile = STROKE_PROFILES.forehand;
  assert.equal(sampleStrokePose('forehand', profile, 0).phase, 'prepare');
  assert.equal(sampleStrokePose('forehand', profile, profile.duration * profile.contactRatio).phase, 'contact');
  assert.equal(sampleStrokePose('forehand', profile, profile.duration * 0.6).phase, 'follow-through');
  assert.equal(sampleStrokePose('forehand', profile, profile.duration * 0.95).phase, 'recover');
});

test('shot ownership uses explicit metadata and deterministic nearest-player fallback', () => {
  const positions = { player1: { x: 2, y: 2 }, player2: { x: 16, y: 6 } };
  assert.equal(resolveShotSemantics({ from: { x: 15, y: 6 }, to: { x: 5, y: 30 }, type: 'drive' }, positions).playerId, 'player2');
  assert.equal(resolveShotSemantics({ from: { x: 15, y: 6 }, to: { x: 5, y: 30 }, playerId: 'player1', stroke: 'backhand' }, positions).playerId, 'player1');
});

test('invalid explicit shot ownership, stroke, and contact metadata fail safely', () => {
  const positions = { player1: { x: 2, y: 2 } };
  assert.throws(() => resolveShotSemantics({ from: { x: 2, y: 2 }, playerId: 'player5' }, positions), /Unknown striking player/);
  assert.throws(() => resolveShotSemantics({ from: { x: 2, y: 2 }, playerId: 'player1', stroke: 'smash' }, positions), /Unsupported stroke/);
  assert.throws(() => resolveShotSemantics({ from: { x: 2, y: 2 }, playerId: 'player1', contact3d: { x: NaN, y: 2, heightFeet: 2 } }, positions), /contact coordinates/);
});

test('compiled shot timeline prepares before authoritative contact and launches trajectory afterward', () => {
  const play = {
    steps: [
      { id: 'setup', positions: { player1: { x: 15, y: 4 }, ball: { x: 15, y: 6 } } },
      { id: 'drive', positions: { player1: { x: 14, y: 8 }, ball: { x: 14, y: 29 } },
        shot: { from: { x: 15, y: 6 }, to: { x: 14, y: 29 }, type: 'drive', playerId: 'player1', stroke: 'forehand', contact3d: { x: 14.5, y: 7, heightFeet: 2.4 } } }
    ]
  };
  const segment = compilePlayTimeline(play).segments[0];
  assert.ok(segment.contactTime > 0);
  assert.equal(segment.contactTime, segment.trajectoryStartTime);
  assert.ok(segment.trajectoryEndTime <= segment.endTime + 1e-9);
  assert.equal(segment.shotSemantics.playerId, 'player1');
  assert.equal(segment.shotSemantics.stroke, 'forehand');
});
