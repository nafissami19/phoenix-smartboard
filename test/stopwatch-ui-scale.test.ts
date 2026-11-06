import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STOPWATCH_IDLE,stopwatchElapsed,stopwatchStart,stopwatchStop,stopwatchToggle} from '../src/lib/stopwatch';
import {applyUiScale,interfaceSettings,parseUiScale} from '../src/lib/interface-settings';
import {TOAST_DURATION} from '../src/lib/toast';

test('stopwatch time comes from the clock, not from interval tick counts',()=>{
 let w=stopwatchStart(STOPWATCH_IDLE,1000);
 // A throttled tab may only tick once in 5 s; elapsed must still be 5 s.
 assert.equal(stopwatchElapsed(w,6000),5000);
 w=stopwatchStop(w,6250);assert.deepEqual(w,{accumulated:5250,startedAt:null});
 assert.equal(stopwatchElapsed(w,99999),5250,'stopped watch does not advance');
 w=stopwatchToggle(w,10000);assert.equal(stopwatchElapsed(w,10500),5750,'resume accumulates');
 assert.equal(stopwatchStart(w,20000),w,'start while running is a no-op');
 assert.equal(stopwatchElapsed(w,9000),5250,'clock going backwards never subtracts');
 assert.equal(stopwatchStop(STOPWATCH_IDLE,5),STOPWATCH_IDLE);
});

test('interface size setting parses safely and defaults to auto',()=>{
 assert.equal(parseUiScale(undefined),'auto');assert.equal(parseUiScale('auto'),'auto');
 assert.equal(parseUiScale(1.25),1.25);assert.equal(parseUiScale('1.5'),1.5);assert.equal(parseUiScale(1.75),1.75);assert.equal(parseUiScale(1),1);
 for(const bad of [0,2,1.3,'',' ','big',NaN,null,{},'1.25px'])assert.equal(parseUiScale(bad),'auto',String(bad));
 assert.equal(interfaceSettings(null).uiScale,'auto');assert.equal(interfaceSettings({uiScale:1.5}).uiScale,1.5);assert.equal(interfaceSettings({uiScale:9}).uiScale,'auto');
});

test('applyUiScale sets the CSS variable for fixed sizes and removes it for auto',()=>{
 const props=new Map<string,string>();const root={style:{setProperty:(k:string,v:string|null)=>{props.set(k,String(v));},removeProperty:(k:string)=>{const v=props.get(k)??'';props.delete(k);return v;}}};
 applyUiScale(1.5,root);assert.equal(props.get('--ui-scale'),'1.5');
 applyUiScale('auto',root);assert.equal(props.has('--ui-scale'),false);
});

test('toasts stay long enough to read; errors linger longest',()=>{
 assert.ok(TOAST_DURATION.info>=4000);assert.ok(TOAST_DURATION.error>=8000);assert.ok(TOAST_DURATION.error>TOAST_DURATION.warn&&TOAST_DURATION.warn>TOAST_DURATION.info);
});
