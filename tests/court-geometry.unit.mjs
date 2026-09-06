import test from 'node:test';
import assert from 'node:assert/strict';
import { COURT_DIMENSIONS, COURT_LINES, isInNonVolleyZone, isInServiceBox, serviceBoxForServer } from '../court-geometry.js';

test('court geometry names every regulation boundary and split centerline in board feet',()=>{
  assert.deepEqual(COURT_DIMENSIONS,{widthFeet:20,lengthFeet:44,kitchenDepthFeet:7,nearKitchenLineY:15,netY:22,farKitchenLineY:29,netCenterHeightFeet:34/12,netSidelineHeightFeet:3,lineWidthFeet:1/6,ballDiameterMeters:.074});
  assert.deepEqual(COURT_LINES.map(line=>line.name),['near-baseline','far-baseline','left-sideline','right-sideline','near-kitchen-line','far-kitchen-line','near-centerline','far-centerline']);
  assert.deepEqual(COURT_LINES.find(line=>line.name==='near-centerline'),{name:'near-centerline',from:{x:10,y:0},to:{x:10,y:15},lineWidthFeet:1/6});
  assert.deepEqual(COURT_LINES.find(line=>line.name==='far-centerline'),{name:'far-centerline',from:{x:10,y:29},to:{x:10,y:44},lineWidthFeet:1/6});
});

test('non-volley-zone includes its lines but not the adjacent service courts',()=>{
  for(const point of [{x:0,y:15},{x:10,y:22},{x:20,y:29}])assert.equal(isInNonVolleyZone(point),true);
  for(const point of [{x:10,y:14.999},{x:10,y:29.001},{x:-.01,y:22}])assert.equal(isInNonVolleyZone(point),false);
});

test('service boxes are diagonal and remain on the correct side of the kitchen',()=>{
  const farLeft=serviceBoxForServer({x:15,y:0});
  assert.deepEqual(farLeft,{minX:0,maxX:10,minY:29,maxY:44});
  assert.equal(isInServiceBox({x:5,y:38},farLeft),true);
  assert.equal(isInServiceBox({x:15,y:38},farLeft),false);
  assert.equal(isInServiceBox({x:5,y:28.9},farLeft),false);
  const nearRight=serviceBoxForServer({x:5,y:44});
  assert.deepEqual(nearRight,{minX:10,maxX:20,minY:0,maxY:15});
});
