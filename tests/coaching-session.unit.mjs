import test from 'node:test';
import assert from 'node:assert/strict';
import { CoachingSession } from '../coaching-session.js';

test('loop completes final recovery, holds, then resets without backwards flight', () => {
 const s=new CoachingSession();s.reset(4);s.loop=true;s.play(0);
 assert.equal(s.tick(4000),4);assert.equal(s.holding,true);assert.equal(s.iteration,0);
 assert.equal(s.tick(4500),4);assert.equal(s.holdElapsed,.5);
 assert.equal(s.tick(5000),0);assert.equal(s.iteration,1);assert.equal(s.holding,false);
});
test('50 repetitions and multi-boundary jumps have bounded state and no drift',()=>{
 const s=new CoachingSession();s.reset(4);s.loop=true;s.play(0);s.tick(250000);
 assert.equal(s.iteration,50);assert.equal(s.clock.elapsed,0);assert.equal(s.holdElapsed,0);
 s.tick(253250);assert.equal(s.clock.elapsed,3.25);

});
test('pause freezes end hold; disabling during hold stops; seek never auto-restarts',()=>{
 const s=new CoachingSession();s.reset(4);s.loop=true;s.play(0);s.tick(4000);s.pause(4250);
 s.tick(100000);assert.equal(s.holdElapsed,.25);assert.equal(s.clock.elapsed,4);
 s.play(100000);s.tick(100250);assert.equal(s.holdElapsed,.5);
 s.setLoop(false,100250);assert.equal(s.complete,true);assert.equal(s.clock.playing,false);
 s.seek(4);s.loop=true;s.tick(999999);assert.equal(s.iteration,0);assert.equal(s.clock.elapsed,4);assert.equal(s.holding,false);
});
test('restart preserves preference/rate; exit-style reset cancels progress and holds',()=>{
 const s=new CoachingSession();s.reset(4);s.loop=true;s.clock.setRate(.5);s.play(0);s.tick(8500);
 assert.equal(s.holding,true);s.seek(0);assert.equal(s.loop,true);assert.equal(s.clock.playbackRate,.5);assert.equal(s.clock.playing,false);
 s.reset(0);s.tick(99999);assert.equal(s.holding,false);assert.equal(s.clock.elapsed,0);
});
