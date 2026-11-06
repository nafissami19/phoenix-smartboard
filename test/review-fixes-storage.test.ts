import 'fake-indexeddb/auto';
import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {resolveObjectURL} from 'node:buffer';
import {deleteDB} from 'idb';
import {database,localRequest,localAssetURL,acquireLocalAssetURL,releaseLocalAssetURL,revokeLocalAssetURL} from '../src/lib/local-store';
import {importLesson} from '../src/lib/lesson-bundle';
import {snapshots} from '../src/lib/recovery';
import {restoreDeviceSnapshot} from '../src/lib/device-library';
import type {Page} from '../src/db/schema';
beforeEach(async()=>{await deleteDB('phoenix-smartboard-db');await deleteDB('phoenix-smartboard-recovery');});
const write=(path:string,data:unknown,method='POST')=>localRequest(path,{method,body:JSON.stringify(data)});
async function lesson(slides=1){
  const {notebook}=await(await write('/api/notebooks',{title:'Review fixes'})).json();
  for(let i=1;i<slides;i++)await write(`/api/notebooks/${notebook.id}/pages`,{});
  const {pages}=await(await localRequest(`/api/notebooks/${notebook.id}`)).json();return {id:notebook.id as string,pages:pages as Page[]};
}

test('duplicating a slide copies its content with new IDs right after the source in one renumbered order',async()=>{
  const {id,pages}=await lesson(3);
  const objects=[{id:'t',kind:'text',text:'Copy me',x:1,y:2,color:'#111111',fontSize:20,fontFamily:'Arial',bold:false,groupId:'g'},{id:'s',kind:'stroke',tool:'pen',color:'#000000',width:3,points:[{x:0,y:0},{x:5,y:5}],groupId:'g'}];
  const media=[{id:'m',kind:'image',assetId:'asset',x:0,y:0,width:10,height:10,rotation:0,pageNumber:1}];
  await write(`/api/pages/${pages[1].id}`,{objects,media,background:'#abcdef',pattern:'grid',importFrame:{x:0,y:0,width:100,height:50}},'PUT');
  const response=await localRequest(`/api/pages/${pages[1].id}/duplicate`,{method:'POST'});assert.equal(response.status,201);
  const {page}=await response.json();
  assert.notEqual(page.id,pages[1].id);assert.equal(page.notebookId,id);assert.equal(page.position,2);assert.equal(page.background,'#abcdef');assert.equal(page.pattern,'grid');assert.deepEqual(page.importFrame,{x:0,y:0,width:100,height:50});
  assert.deepEqual(page.objects.map((o:{text?:string})=>o.text),['Copy me',undefined]);assert.ok(page.objects.every((o:{id:string})=>!['t','s'].includes(o.id)));
  assert.equal(page.objects[0].groupId,page.objects[1].groupId);assert.notEqual(page.objects[0].groupId,'g');
  assert.notEqual(page.media[0].id,'m');assert.equal(page.media[0].assetId,'asset');
  const reopened=await(await localRequest(`/api/notebooks/${id}`)).json();
  assert.deepEqual(reopened.pages.map((p:Page)=>p.id),[pages[0].id,pages[1].id,page.id,pages[2].id]);assert.deepEqual(reopened.pages.map((p:Page)=>p.position),[0,1,2,3]);
  assert.equal(reopened.notebook.pageCount,4);
  assert.equal((await localRequest('/api/pages/missing/duplicate',{method:'POST'})).status,404);
});

test('first-page returns only the lowest-position slide',async()=>{
  const {id,pages}=await lesson(3);
  assert.equal((await(await localRequest(`/api/notebooks/${id}/first-page`)).json()).page.id,pages[0].id);
  await write(`/api/notebooks/${id}/pages/reorder`,{pageIds:[pages[2].id,pages[0].id,pages[1].id]},'PUT');
  const body=await(await localRequest(`/api/notebooks/${id}/first-page`)).json();assert.deepEqual(Object.keys(body),['page']);assert.equal(body.page.id,pages[2].id);
  assert.equal((await localRequest('/api/notebooks/missing/first-page')).status,404);
});

test('deletes proceed when the recovery copy fails, and slide deletes keep only that slide',async()=>{
  const {id,pages}=await lesson(2);
  const {asset}=await(await write('/api/assets',{notebookId:id,name:'a.png',mimeType:'image/png',dataBase64:btoa('used')})).json();
  await write('/api/assets',{notebookId:id,name:'b.png',mimeType:'image/png',dataBase64:btoa('unused')});
  await write(`/api/pages/${pages[1].id}`,{media:[{id:'m',kind:'image',assetId:asset.id,x:0,y:0,width:5,height:5,rotation:0,pageNumber:1}]},'PUT');
  assert.equal((await localRequest(`/api/pages/${pages[1].id}`,{method:'DELETE'})).status,200);
  const [copy]=await snapshots(id);assert.equal(copy.pageId,pages[1].id);
  const manifest=JSON.parse(await copy.blob.text());assert.equal(manifest.pages.length,1);assert.deepEqual(manifest.assets.map((a:{name:string})=>a.name),['a.png']);
  // An unreadable binary makes the full-lesson export throw; the confirmed delete still happens.
  const db=await database();await db.put('assets',{id:'broken',notebookId:id,name:'x',mimeType:'image/png',blob:{not:'a blob'} as unknown as Blob});db.close();
  assert.equal((await localRequest(`/api/notebooks/${id}`,{method:'DELETE'})).status,200);
  assert.equal((await localRequest(`/api/notebooks/${id}`)).status,404);
});

test('malformed request bodies fail before a transaction and the shared connection keeps working',async()=>{
  await assert.rejects(()=>localRequest('/api/profile',{method:'PUT',body:'{'}),SyntaxError);
  assert.equal((await write('/api/profile',{teacherName:'Ada'},'PUT')).status,200);
  await deleteDB('phoenix-smartboard-db');
  assert.equal((await(await localRequest('/api/profile')).json()).profile.teacherName,'');
});

test('referenced media URLs survive cache eviction until released',async()=>{
  const db=await database();for(let i=0;i<60;i++)await db.put('assets',{id:`a${i}`,notebookId:'n',name:'f',mimeType:'video/mp4',blob:new Blob([String(i)])});db.close();
  revokeLocalAssetURL();
  const held=await acquireLocalAssetURL('a0'),loose=await localAssetURL('a1');
  for(let i=2;i<60;i++)await localAssetURL(`a${i}`);
  assert.ok(resolveObjectURL(held),'a playing URL is never revoked');assert.equal(resolveObjectURL(loose),undefined);
  releaseLocalAssetURL('a0');await localAssetURL('a1');assert.equal(resolveObjectURL(held),undefined);
  revokeLocalAssetURL();
});

const manifest=(objects:unknown[],format='phoenix-smartboard',version=1)=>new Blob([JSON.stringify({format,version,notebook:{title:'Import'},pages:[{background:'#ffffff',pattern:'none',objects,media:[]}],assets:[]})]);
const text={kind:'text',text:'Hello',x:0,y:0,color:'#111',fontSize:24,fontFamily:'Arial',bold:false};
const shape={kind:'shape',shape:'rect',x:0,y:0,w:10,h:10,color:'#000000',width:2,filled:false,rotation:0};
test('lesson import accepts only known formats and versions and validates text and shapes',async()=>{
  assert.ok(await importLesson(manifest([text,shape])));assert.ok(await importLesson(manifest([],'kopy-notes',2)));
  await assert.rejects(()=>importLesson(manifest([],'something-else')),/Invalid lesson format/);
  await assert.rejects(()=>importLesson(manifest([],'phoenix-smartboard',3)),/Unsupported lesson version/);
  await assert.rejects(()=>importLesson(manifest([],'kopy-notes',7)),/Unsupported lesson version/);
  for(const bad of [{...text,text:42},{...text,text:'x'.repeat(100001)},{...text,fontSize:'big'},{...text,x:Infinity},{...text,fontSize:-4}])await assert.rejects(()=>importLesson(manifest([bad])),/Invalid text object/);
  for(const bad of [{...shape,shape:'blob'},{...shape,w:null},{...shape,width:Number.NaN},{...shape,x:1e12}])await assert.rejects(()=>importLesson(manifest([bad])),/Invalid shape/);
  await assert.rejects(()=>importLesson(manifest([null])),/Unsupported board object/);
});

test('device restore sanitises the profile and gives an empty lesson a blank slide',async()=>{
  const now=new Date().toISOString();
  const copy={format:'phoenix-device-library',version:1,profile:{id:7,appName:'A'.repeat(90),accent:'red;background:url(x)',boardBg:'#123456',onboarded:1,iconData:'javascript:alert(1)',createdAt:now,updatedAt:now,theme:{schema:'bad'}},notebooks:[{id:'empty',title:'Empty',subject:'General',coverColor:'#000000',pageCount:0,createdAt:now,updatedAt:now}],pages:[],assets:[]};
  await restoreDeviceSnapshot(JSON.stringify(copy));
  const {profile}=await(await localRequest('/api/profile')).json();
  assert.equal(profile.id,1);assert.equal(profile.appName.length,60);assert.match(profile.accent,/^#[\da-f]{6}$/i);assert.equal(profile.boardBg,'#123456');assert.equal(profile.onboarded,1);assert.equal(profile.iconData,undefined);assert.equal(profile.theme,undefined);
  const lessonCopy=await(await localRequest('/api/notebooks/empty')).json();assert.equal(lessonCopy.pages.length,1);assert.equal(lessonCopy.pages[0].background,'#123456');assert.equal(lessonCopy.notebook.pageCount,1);
});
