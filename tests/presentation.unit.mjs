import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePlayTimeline } from '../three-d-core.js';
import { VIEW_DIRECTIONS, sampleActorPresentation, selectCameraRelativeDirection } from '../three-d-presentation.js';
import { PICKLEBOARD_PLAYS as plays } from '../play-catalog.js';
const cameras = [
  { x: 0, y: 12, z: 9 }, { x: 9, y: 2, z: 0 },
  { x: 0, y: 2, z: -10 }, { x: 0, y: 2, z: 10 }
];

test('eight camera-relative compass sectors are stable', () => {
  const actor = { x: 0, z: 0 };
  const facing = { x: 0, z: 1 };
  const sampled = new Set();
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    sampled.add(selectCameraRelativeDirection(facing, actor, { x: Math.sin(angle), z: Math.cos(angle) }));
  }
  assert.deepEqual([...sampled].sort(), [...VIEW_DIRECTIONS].sort());
});

test('camera-forward atlas selection does not rotate an actor merely because the actor translates',()=>{
  const facing={x:0,z:1},camera={x:5,y:12,z:9},target={x:0,y:0,z:0};
  assert.equal(selectCameraRelativeDirection(facing,{x:-4,z:-5},camera,target),
    selectCameraRelativeDirection(facing,{x:4,z:5},camera,target));
});

test('every Play samples deterministically across cameras and physical hands', () => {
  for (const play of plays) {
    const timeline = compilePlayTimeline(play);
    for (const segment of timeline.segments) {
      for (const playerId of ['player1', 'player2', 'player3', 'player4']) {
        for (const handedness of ['left', 'right']) for (const cameraPosition of cameras) {
          const args = { segment, playerId, localTime: segment.duration * 0.37, cameraPosition, handedness };
          assert.deepEqual(sampleActorPresentation(args), sampleActorPresentation(args));
        }
      }
    }
  }
});

test('stationary actors never walk and lateral movers keep court-facing posture', () => {
  const timeline = compilePlayTimeline(plays.find(play => play.id === 'third-shot-drop'));
  const segment = timeline.segments.find(item => item.step.id === 'drop-transition');
  const stationary = sampleActorPresentation({ segment, playerId: 'player3', localTime: segment.duration / 2,
    cameraPosition: cameras[0], handedness: 'right' });
  assert.equal(stationary.action, 'ready');
  assert.equal(stationary.locomotionFrame, null);
  const mover = sampleActorPresentation({ segment, playerId: 'player1', localTime: segment.duration / 2,
    cameraPosition: cameras[0], handedness: 'right' });
  assert.equal(mover.action, 'shuffle');
  assert.deepEqual(mover.bodyFacing, { x: 0, z: 1 });
  const stopped = sampleActorPresentation({ segment, playerId: 'player1', localTime: segment.duration,
    cameraPosition: cameras[0], handedness: 'right' });
  assert.equal(stopped.action, 'ready');
  assert.equal(stopped.locomotionFrame, null);
});

test('contact exposes authoritative target and distinct unmirrored handed assets', () => {
  for (const play of plays) for (const segment of compilePlayTimeline(play).segments.filter(item => item.trajectory)) {
    const common = { segment, playerId: segment.shotSemantics.playerId, localTime: segment.contactTime,
      cameraPosition: cameras[1] };
    const left = sampleActorPresentation({ ...common, handedness: 'left' });
    const right = sampleActorPresentation({ ...common, handedness: 'right' });
    assert.equal(left.phase, 'contact');
    assert.deepEqual(left.paddle.worldContactTarget, segment.trajectory.start);
    assert.notEqual(left.atlasKey, right.atlasKey);
    assert.equal(left.paddle.anchorId, 'left-paddle-face');
    assert.equal(right.paddle.anchorId, 'right-paddle-face');
  }
});

test('phase anchors progress through a stroke and settle to ready', () => {
  const timeline = compilePlayTimeline(plays.find(play => play.id === 'third-shot-drive'));
  const segment = timeline.segments.find(item => item.step.id === 'serve');
  const profile = segment.shotSemantics.profile;
  const sample = localTime => sampleActorPresentation({ segment,
    playerId: segment.shotSemantics.playerId, localTime, cameraPosition: cameras[1], handedness: 'right' });
  assert.equal(sample(profile.duration * profile.prepareRatio * 0.5).phase, 'prepare');
  assert.equal(sample(segment.contactTime).phase, 'contact');
  assert.equal(sample(profile.duration * 0.6).phase, 'follow-through');
  assert.equal(sample(profile.duration * 0.9).phase, 'recover');
  assert.equal(sample(segment.duration).phase, 'ready');
});

test('striker facing remains continuous through planting and contact', () => {
  for (const play of plays) for (const segment of compilePlayTimeline(play).segments.filter(item => item.trajectory)) {
    const common = { segment, playerId: segment.shotSemantics.playerId,
      cameraPosition: cameras[0], handedness: 'right' };
    const before = sampleActorPresentation({ ...common, localTime: Math.max(0, segment.contactTime - 0.08) });
    const contact = sampleActorPresentation({ ...common, localTime: segment.contactTime });
    const after = sampleActorPresentation({ ...common, localTime: segment.contactTime + 0.08 });
    assert.deepEqual(before.bodyFacing, contact.bodyFacing);
    assert.deepEqual(contact.bodyFacing, after.bodyFacing);
    assert.equal(before.viewDirection, contact.viewDirection);
    assert.equal(contact.viewDirection, after.viewDirection);
  }
});

// Step endpoints remain exact while a hitter plants at the shot before advancing.
test('return contact plants within paddle reach before the final destination', () => {
  for(const play of plays) for(const segment of compilePlayTimeline(play).segments.filter(s=>s.trajectory)) {
    for(const handedness of ['left','right']){
      const common={segment,playerId:segment.shotSemantics.playerId,cameraPosition:cameras[0],handedness};
      const contact=sampleActorPresentation({...common,localTime:segment.contactTime});
      const target=segment.trajectory.start;
      assert.ok(Math.hypot(contact.worldPosition.x-target.x,contact.worldPosition.z-target.z)<0.46);
      const end=sampleActorPresentation({...common,localTime:segment.duration});
      const expected=segment.step.positions[common.playerId];
      assert.ok(Math.abs(end.worldPosition.x-(expected.x-10)*0.3048)<1e-9);
      assert.ok(Math.abs(end.worldPosition.z-(expected.y-22)*0.3048)<1e-9);
      assert.equal(end.action,'ready');
    }
  }
});

test('every player remains grounded and continuous across rally-stage boundaries',()=>{
  for(const play of plays){
    const timeline=compilePlayTimeline(play);
    for(let index=0;index<timeline.segments.length-1;index++){
      const before=timeline.segments[index],after=timeline.segments[index+1];
      for(const playerId of ['player1','player2','player3','player4']){
        const common={playerId,cameraPosition:cameras[0],cameraTarget:{x:0,y:0,z:0},handedness:'right',timeline};
        const left=sampleActorPresentation({...common,segment:before,localTime:before.duration});
        const right=sampleActorPresentation({...common,segment:after,localTime:0});
        assert.ok(Math.hypot(left.worldPosition.x-right.worldPosition.x,left.worldPosition.z-right.worldPosition.z)<1e-9,`${play.id}/${playerId}/${index}`);
        assert.equal(left.worldPosition.y,0);
        assert.equal(right.worldPosition.y,0);
        if(before.nextShotSemantics?.playerId===playerId){
          assert.ok(Math.hypot(left.bodyFacing.x-right.bodyFacing.x,left.bodyFacing.z-right.bodyFacing.z)<1e-9);
          assert.equal(left.phase,'contact');
          assert.equal(right.phase,'contact');
          assert.deepEqual(left.paddle.worldContactTarget,before.trajectory.end);
          assert.deepEqual(right.paddle.worldContactTarget,after.trajectory.start);
        }
      }
    }
  }
});
