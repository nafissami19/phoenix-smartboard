import test from 'node:test';
import assert from 'node:assert/strict';
import {sameObjects,samplePressure,minSampleSpacing,isPalmContact,isRestingHand,secondTouchMayPinch} from '../src/lib/pen-input.ts';
import {arcEdges,nearbyGuide,snapToGuide,type GuideEdge} from '../src/lib/guide-geometry.ts';
import {eraseInk} from '../src/lib/erase-ink.ts';
import {eraseSelection} from '../src/lib/eraser-modes.ts';
import type {BoardObject,StrokeObject} from '../src/db/schema.ts';

const stroke=(id:string,y:number,locked=false):StrokeObject=>({id,kind:'stroke',tool:'pen',color:'#fff',width:4,points:[{x:0,y},{x:50,y},{x:100,y}],...(locked?{locked:true}:{})});

test('pens that report zero pressure keep normal width instead of a hairline',()=>{
  assert.equal(samplePressure('pen',true,0),undefined);
  assert.equal(samplePressure('pen',true,0.6),0.6);
  assert.equal(samplePressure('pen',true,0.01),0.05);
  assert.equal(samplePressure('pen',false,0.6),undefined);
  assert.equal(samplePressure('mouse',true,0.5),undefined);
  assert.equal(samplePressure('touch',true,0.5),undefined);
});

test('ink sample spacing stays under a screen pixel at any zoom',()=>{
  assert.equal(minSampleSpacing(1),0.75);
  assert.ok(minSampleSpacing(8)*8<1);
  assert.ok(Number.isFinite(minSampleSpacing(0)));
});

test('palm contact erases only when the palm eraser is on; a resting hand is ignored otherwise',()=>{
  assert.equal(isPalmContact('touch',45,false),false);
  assert.equal(isPalmContact('touch',45,true),true);
  assert.equal(isPalmContact('mouse',45,true),false);
  assert.equal(isRestingHand('touch',45,false),true);
  assert.equal(isRestingHand('touch',20,false),false);
  assert.equal(isRestingHand('touch',45,true),false);
  assert.equal(isRestingHand('pen',45,false),false);
});

test('a second finger pinches only at the very start of a stroke',()=>{
  assert.equal(secondTouchMayPinch(2,500),true);
  assert.equal(secondTouchMayPinch(40,100),true);
  assert.equal(secondTouchMayPinch(40,600),false);
});

test('ruler snapping follows the chosen instrument and releases once the pen leaves its edge',()=>{
  const ruler:GuideEdge[]=[{a:{x:0,y:100},b:{x:400,y:100}}];
  const far:GuideEdge[]=[{a:{x:0,y:400},b:{x:400,y:400}}];
  assert.equal(nearbyGuide({x:50,y:110},[far,ruler]),ruler);
  assert.equal(nearbyGuide({x:50,y:250},[far,ruler]),undefined);
  assert.deepEqual(snapToGuide({x:200,y:112},ruler),{x:200,y:100,p:undefined});
  assert.equal(snapToGuide({x:200,y:160},ruler),undefined);
});

test('compass arcs snap to the nearest segment, so writing follows the curve instead of a straight dash',()=>{
  const arc=arcEdges({x:0,y:0},100,0,Math.PI);
  const a=snapToGuide({x:100,y:5},arc)!,b=snapToGuide({x:0,y:104},arc)!;
  assert.ok(Math.abs(Math.hypot(a.x,a.y)-100)<1);
  assert.ok(Math.abs(Math.hypot(b.x,b.y)-100)<1);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>100,'two samples far apart on the arc stay far apart');
});

test('erasers skip locked strokes and report "nothing changed" so no empty undo step is recorded',()=>{
  const objects:BoardObject[]=[stroke('a',0),stroke('b',50,true)];
  const ink=eraseInk(objects,{x:50,y:-10},{x:50,y:60},6);
  assert.ok(ink.some(o=>o.id==='b'&&(o as StrokeObject).points.length===3),'locked stroke untouched');
  assert.ok(!ink.some(o=>o.id==='a'&&(o as StrokeObject).points.length===3),'unlocked stroke was cut');
  const nothing=eraseInk(objects,{x:500,y:500},{x:510,y:510},6);
  assert.ok(sameObjects(nothing,objects));
  assert.equal(eraseSelection(objects,{x:400,y:400},{x:500,y:500}),objects);
  const selected=eraseSelection(objects,{x:-10,y:-10},{x:110,y:60});
  assert.deepEqual(selected.map(o=>o.id),['b']);
});
