import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_PRESETS,
  COURT_DIMENSIONS,
  FEET_TO_METERS,
  PlaybackClock,
  boardToWorld,
  createTrajectory
} from '../three-d-core.js';

test('board coordinates map centrally to Three.js x/z with y reserved for height', () => {
  assert.deepEqual(boardToWorld({ x: 10, y: 22 }), { x: 0, y: 0, z: 0 });
  assert.deepEqual(boardToWorld({ x: 0, y: 0 }, 3), {
    x: -10 * FEET_TO_METERS,
    y: 3 * FEET_TO_METERS,
    z: -22 * FEET_TO_METERS
  });
});

test('court and camera constants expose regulation dimensions and four presets', () => {
  assert.equal(COURT_DIMENSIONS.widthFeet, 20);
  assert.equal(COURT_DIMENSIONS.lengthFeet, 44);
  assert.equal(COURT_DIMENSIONS.netCenterHeightFeet, 34 / 12);
  assert.deepEqual(Object.keys(CAMERA_PRESETS), ['overhead', 'sideline', 'behind-green', 'behind-orange']);
});

test('Third Shot Drop trajectory clears the net, lands at target, and bounces', () => {
  const trajectory = createTrajectory({
    from: { x: 15, y: 6 },
    to: { x: 7, y: 27 },
    type: 'drop',
    trajectory3d: {
      speedMph: 18,
      apexFeet: 7.5,
      netClearanceInches: 16,
      contactHeightFeet: 2.2,
      spin: { type: 'backspin', rpm: 550 },
      bounce: { enabled: true, heightFeet: 1.25 }
    }
  });
  const requiredHeight = (COURT_DIMENSIONS.netCenterHeightFeet + 16 / 12) * FEET_TO_METERS;
  assert.ok(trajectory.netCrossingHeightMeters > requiredHeight);
  const landing = trajectory.sample(trajectory.flightDuration);
  assert.ok(Math.abs(landing.x - trajectory.landing.x) < 1e-9);
  assert.ok(Math.abs(landing.z - trajectory.landing.z) < 1e-9);
  const bounce = trajectory.sample(trajectory.flightDuration + trajectory.bounceDuration / 2);
  assert.equal(bounce.phase, 'bounce');
  assert.equal(bounce.bounced, true);
  assert.ok(bounce.y > trajectory.landing.y);
});

test('invalid trajectory metadata fails safely', () => {
  assert.throws(() => createTrajectory({
    from: { x: 15, y: 6 }, to: { x: 7, y: 27 }, type: 'drop',
    trajectory3d: { speedMph: 18, apexFeet: 2, netClearanceInches: 16 }
  }), /cannot provide|does not clear/);
  assert.throws(() => createTrajectory({
    from: { x: 15, y: 6 }, to: { x: 7, y: 27 }, trajectory3d: { speedMph: 0 }
  }), /greater than zero/);
});

test('spin provides distinct illustrative post-bounce travel', () => {
  const make = type => createTrajectory({
    from: { x: 15, y: 6 }, to: { x: 7, y: 27 }, type: 'drop',
    trajectory3d: { apexFeet: 8, netClearanceInches: 16, spin: { type, rpm: 500 } }
  });
  const top = make('topspin');
  const back = make('backspin');
  const topDistance = Math.hypot(top.bounceEnd.x - top.landing.x, top.bounceEnd.z - top.landing.z);
  const backDistance = Math.hypot(back.bounceEnd.x - back.landing.x, back.bounceEnd.z - back.landing.z);
  assert.ok(topDistance > backDistance);
});

test('central clock pauses and playback rate scales elapsed simulation time', () => {
  const clock = new PlaybackClock();
  clock.play(1000);
  assert.equal(clock.update(2000), 1);
  clock.pause();
  assert.equal(clock.update(3000), 1);
  clock.setRate(0.5);
  clock.play(3000);
  assert.equal(clock.update(5000), 2);
  clock.restart();
  assert.equal(clock.elapsed, 0);
});
