import test from 'node:test';
import assert from 'node:assert/strict';
import {drawObject,objectBounds,isDrawableObject,pointNearStroke} from '../src/lib/render';
import type {BoardObject} from '../src/db/schema';

// Minimal 2D context: every method is a no-op, measureText reports a width per character.
const ctx=new Proxy({} as Record<string,unknown>,{get:(target,key)=>typeof key==='string'&&key in target?target[key]:key==='measureText'?(text:string)=>({width:String(text).length*10}):()=>undefined,set:(target,key,value)=>{target[key as string]=value;return true;}}) as unknown as CanvasRenderingContext2D;

test('malformed saved objects are skipped instead of throwing every frame',()=>{
  const broken=[null,{kind:'stroke'},{kind:'stroke',points:[{x:1}],width:2},{kind:'shape',x:'a',y:0,w:1,h:1},{kind:'text',x:0,y:0},{kind:'unknown'}] as unknown as BoardObject[];
  for(const object of broken){
    assert.equal(isDrawableObject(object),false);
    assert.doesNotThrow(()=>drawObject(ctx,object));
    assert.deepEqual(objectBounds(object,ctx),{x:0,y:0,w:0,h:0});
  }
  assert.equal(pointNearStroke({x:0,y:0},broken[1] as never,4),false);
});

test('text with a non-string value still wraps and measures',()=>{
  const text={id:'t',kind:'text',x:5,y:5,text:12345 as unknown as string,color:'#000',fontSize:20,fontFamily:'Arial',bold:false} as BoardObject;
  assert.equal(isDrawableObject(text),true);
  assert.doesNotThrow(()=>drawObject(ctx,text));
  assert.equal(objectBounds(text,ctx).w,50);
});
