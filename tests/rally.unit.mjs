import test from 'node:test';
import assert from 'node:assert/strict';
import { PICKLEBOARD_PLAYS } from '../play-catalog.js';
import { compilePlayTimeline, samplePlayBall, samplePlayState } from '../three-d-core.js';
import { validateRallyRules } from '../rally-rules.js';

const play=id=>PICKLEBOARD_PLAYS.find(item=>item.id===id);

test('the shared catalog compiles and passes scoped rally rules',()=>{
  assert.equal(PICKLEBOARD_PLAYS.length,8);
  for(const item of PICKLEBOARD_PLAYS){
    const result=validateRallyRules(item,compilePlayTimeline(item));
    assert.deepEqual(result.violations,[],item.id);
    assert.equal(result.valid,true,item.id);
  }
});

test('timeline events are immutable, stable, globally ordered rally facts',()=>{
  const timeline=compilePlayTimeline(play('third-shot-drive'));
  assert.equal(Object.isFrozen(timeline.events),true);
  assert.equal(new Set(timeline.events.map(event=>event.id)).size,timeline.events.length);
  for(let index=1;index<timeline.events.length;index++)assert.ok(timeline.events[index].time>=timeline.events[index-1].time);
  assert.deepEqual(timeline.events.filter(event=>event.rallyLeg===3).map(event=>event.type),['contact','net-crossing','end']);
  assert.deepEqual(timeline.events.filter(event=>event.rallyLeg===4).map(event=>event.type),['contact','net-crossing','bounce','end']);
  assert.equal(timeline.segments.find(segment=>segment.rallyLeg===3).endpoint,'next-contact');
});

test('opening shots bounce once while a drive into a block does not bounce',()=>{
  const timeline=compilePlayTimeline(play('third-shot-drive'));
  const legs=timeline.segments.filter(segment=>segment.trajectory);
  assert.deepEqual(legs.map(segment=>segment.trajectory.bounces),[1,1,0,1]);
  assert.equal(timeline.events.filter(event=>event.type==='bounce'&&event.rallyLeg===1).length,1);
  assert.equal(timeline.events.filter(event=>event.type==='bounce'&&event.rallyLeg===2).length,1);
  assert.equal(timeline.events.filter(event=>event.type==='bounce'&&event.rallyLeg===3).length,0);
});

test('contact kind agrees with the preceding leg bounce and reports play/actor context',()=>{
  const source=play('serve-and-return');
  const steps=source.steps.map((step,index)=>index===2?{
    ...step,
    shot:{...step.shot,contact:{...step.shot.contact,kind:'volley'}}
  }:step);
  const mislabeled={...source,id:'volley-after-bounced-serve',steps};
  const result=validateRallyRules(mislabeled);
  const mismatch=result.violations.find(item=>item.code==='incoming-bounce-contact-kind');
  assert.deepEqual(mismatch,{
    code:'incoming-bounce-contact-kind',
    message:'A volley contact must arrive without a ground bounce in the preceding rally leg.',
    stepId:'return',
    playId:'volley-after-bounced-serve',
    actor:'player3'
  });

  const midRally=validateRallyRules(play('volley-block'));
  assert.equal(midRally.violations.some(item=>item.code==='incoming-bounce-contact-kind'),false,
    'the first represented mid-rally contact has no authored incoming leg to validate');
});

test('one ball sampler is continuous across every segment and contact boundary',()=>{
  for(const item of PICKLEBOARD_PLAYS){
    const timeline=compilePlayTimeline(item);
    const times=[...timeline.segments.slice(1).map(segment=>segment.startTime),...timeline.events.filter(event=>event.type==='contact').map(event=>event.time)];
    for(const time of times){
      const before=samplePlayBall(timeline,Math.max(0,time-1e-7)),at=samplePlayBall(timeline,time),after=samplePlayBall(timeline,Math.min(timeline.duration,time+1e-7));
      assert.ok(Math.hypot(before.x-at.x,before.y-at.y,before.z-at.z)<2e-5,`${item.id} before ${time}`);
      assert.ok(Math.hypot(after.x-at.x,after.y-at.y,after.z-at.z)<2e-5,`${item.id} after ${time}`);
    }
  }
});

test('short-hop has one nearby bounce and a low contact, and final outcomes hold',()=>{
  const timeline=compilePlayTimeline(play('short-hop-reset'));
  const bounce=timeline.events.find(event=>event.type==='bounce'&&event.rallyLeg===1);
  const contact=timeline.events.find(event=>event.type==='contact'&&event.rallyLeg===2);
  const shortHop=timeline.segments.find(segment=>segment.rallyLeg===2);
  assert.ok(contact.time-bounce.time>0&&contact.time-bounce.time<=.35);
  assert.equal(shortHop.shotSemantics.contact.point.heightFeet,.8);
  const end=samplePlayBall(timeline,timeline.duration),later=samplePlayBall(timeline,timeline.duration+10);
  assert.deepEqual(later,end);
  assert.equal(end.phase,'bounce');
});

test('sampled shared positions use the canonical ball projection',()=>{
  const timeline=compilePlayTimeline(play('dink-exchange')),time=timeline.duration*.43;
  const state=samplePlayState(timeline,time),ball=samplePlayBall(timeline,time);
  assert.deepEqual(state.positions.ball,ball.board);
  assert.equal(state.stepIndex,state.segment.index);
});

function fixture({serveTo={x:5,y:38},returnBounces=1,volleyFeet=[{x:5,y:29.5},{x:6,y:29.5}],momentum=false,groundInKitchen=false}={}){
  return{id:'rule-fixture',mode:'doubles',rally:{openingBouncesSatisfied:false},steps:[
    {id:'setup',positions:{player1:{x:15,y:-1},player2:{x:5,y:-1},player3:{x:5,y:40},player4:{x:15,y:30},ball:{x:15,y:0}}},
    {id:'serve',positions:{player1:{x:15,y:1},player2:{x:5,y:0},player3:{x:5,y:40},player4:{x:15,y:30},ball:serveTo},shot:{from:{x:15,y:0},to:serveTo,type:'serve',stroke:'serve',playerId:'player1',contact:{kind:'serve',heightFeet:2.5,strokeSide:'forehand'},flight:{bounces:1,apexFeet:12}}},
    {id:'return',positions:{player1:{x:15,y:5},player2:{x:5,y:0},player3:{x:5,y:35},player4:{x:15,y:30},ball:{x:15,y:groundInKitchen?20:6}},shot:{from:{x:5.3,y:38.5},to:{x:15,y:groundInKitchen?20:6},type:'return',stroke:'forehand',playerId:'player3',contact:{kind:groundInKitchen?'groundstroke':'volley',heightFeet:groundInKitchen?1.5:3,strokeSide:'forehand',feet:volleyFeet,momentumEntersNonVolleyZone:momentum},flight:{bounces:returnBounces}}}
  ]};
}

test('validator rejects kitchen serves and opening-bounce violations',()=>{
  const badServe=validateRallyRules(fixture({serveTo:{x:5,y:27}}));
  const target=badServe.violations.find(item=>item.code==='serve-target');
  assert.deepEqual({playId:target.playId,stepId:target.stepId,actor:target.actor},
    {playId:'rule-fixture',stepId:'serve',actor:'player1'});
  const badReturn=validateRallyRules(fixture({returnBounces:0}));
  assert.ok(badReturn.violations.some(item=>item.code==='return-bounce'));
});

test('validator trusts compiled bounce facts and rejects an extra event',()=>{
  const item=play('serve-and-return'),timeline=compilePlayTimeline(item);
  const firstBounce=timeline.events.find(event=>event.type==='bounce'&&event.rallyLeg===1);
  const corrupted={...timeline,events:[...timeline.events,{...firstBounce,id:`${firstBounce.id}:duplicate`,time:firstBounce.time+.001}]};
  const result=validateRallyRules(item,corrupted);
  assert.ok(result.violations.some(item=>item.code==='bounce-event-mismatch'));
  assert.ok(result.violations.some(item=>item.code==='serve-bounce'));
});

test('validator checks volley feet and momentum without banning a bounced kitchen contact',()=>{
  const footFault=validateRallyRules(fixture({volleyFeet:[{x:5,y:20},{x:6,y:29.5}]}));
  assert.ok(footFault.violations.some(item=>item.code==='non-volley-zone-foot'));
  const momentumFault=validateRallyRules(fixture({momentum:true}));
  assert.ok(momentumFault.violations.some(item=>item.code==='non-volley-zone-momentum'));
  const legalGround=validateRallyRules(fixture({groundInKitchen:true}));
  assert.equal(legalGround.violations.some(item=>item.code.startsWith('non-volley-zone')),false);
});

test('short-hop incoming rebound is still rising at contact, not a second falling arc', () => {
  const timeline=compilePlayTimeline(PICKLEBOARD_PLAYS.find(play=>play.id==='short-hop-reset'));
  const leg=timeline.segments.find(s=>s.nextShotSemantics?.contact.kind==='short-hop');
  const at=samplePlayBall(timeline,leg.endTime),before=samplePlayBall(timeline,leg.endTime-.01);
  assert.ok(at.y>before.y,'the low ball must still rise toward the short-hop paddle');
});

test('the backhand reset uses backhand artwork with its compact reset timing',()=>{
  const timeline=compilePlayTimeline(play('short-hop-reset'));
  const reset=timeline.segments.find(s=>s.step.id==='reset').shotSemantics;
  assert.equal(reset.strokeSide,'backhand');
  assert.equal(reset.artAction,'backhand');
  assert.equal(reset.profile.duration,.58);
  assert.equal(reset.profile.intensity,.3);
});

test('mid-rally preconditions are visible and every authored backhand selects backhand art',()=>{
  for(const item of PICKLEBOARD_PLAYS){
    if(item.rally.openingBouncesSatisfied)assert.match(item.steps[0].description,/Serve and return have already bounced\./,item.id);
    for(const s of compilePlayTimeline(item).segments){
      if(s.shotSemantics?.strokeSide==='backhand')assert.equal(s.shotSemantics.artAction,'backhand',`${item.id}/${s.step.id}`);
    }
  }
});
