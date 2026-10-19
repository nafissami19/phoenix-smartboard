import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {localRequest} from '../src/lib/local-store';
import {exportLesson,importLesson} from '../src/lib/lesson-bundle';
const write=(path:string,data:unknown,method='POST')=>localRequest(path,{method,body:JSON.stringify(data)});
test('new slides inherit the current background, pattern and embedded image through portable backups',async()=>{
 const {notebook}=await(await write('/api/notebooks',{title:'Background inheritance'})).json(),path=`/api/notebooks/${notebook.id}`;
 const {pages}=await(await localRequest(path)).json();const image='data:image/png;base64,aGVsbG8=';
 await write(`/api/pages/${pages[0].id}`,{background:'#f0f5ee',pattern:'isometric',backgroundImage:image},'PUT');
 const {page}=await(await write(`${path}/pages`,{afterPageId:pages[0].id})).json();assert.equal(page.background,'#f0f5ee');assert.equal(page.pattern,'isometric');assert.equal(page.backgroundImage,image);
 const restored=await importLesson(await exportLesson(notebook.id));assert.equal((await(await localRequest(`/api/notebooks/${restored}`)).json()).pages[1].backgroundImage,image);
});
test('new slides insert after the current slide atomically and reject foreign anchors',async()=>{
  const {notebook}=await(await write('/api/notebooks',{title:'Insert slides'})).json();const path=`/api/notebooks/${notebook.id}`;
  const {pages:first}=await(await localRequest(path)).json();const {page:last}=await(await write(`${path}/pages`,{})).json();
  const {page:middle}=await(await write(`${path}/pages`,{afterPageId:first[0].id})).json();
  const {pages}=await(await localRequest(path)).json();assert.deepEqual(pages.map((p:{id:string})=>p.id),[first[0].id,middle.id,last.id]);assert.deepEqual(pages.map((p:{position:number})=>p.position),[0,1,2]);
  assert.equal((await write(`${path}/pages`,{afterPageId:'not-this-lesson'})).status,400);
  assert.equal((await(await localRequest(path)).json()).pages.length,3);
});
test('slide reorder is durable, rejects incomplete or foreign IDs, and survives portable export',async()=>{
  const {notebook}=await (await write('/api/notebooks',{title:'Slide ordering'})).json();
  const path=`/api/notebooks/${notebook.id}`;
  await write(`${path}/pages`,{});await write(`${path}/pages`,{});
  const {pages}=await (await localRequest(path)).json();
  for(let index=0;index<pages.length;index++)await write(`/api/pages/${pages[index].id}`,{objects:[{id:`text-${index}`,kind:'text',x:30,y:30,text:`Slide ${index}`,color:'#000000',fontSize:24,fontFamily:'Arial',bold:false}]},'PUT');
  const ids=[pages[2].id,pages[0].id,pages[1].id];
  assert.equal((await write(`${path}/pages/reorder`,{pageIds:ids},'PUT')).status,200);
  const reopened=await (await localRequest(path)).json();assert.deepEqual(reopened.pages.map((page:{id:string})=>page.id),ids);assert.deepEqual(reopened.pages.map((page:{position:number})=>page.position),[0,1,2]);
  for(const invalid of [[ids[0]], [ids[0],ids[0],ids[2]], [ids[0],ids[1],'foreign-page']]){
    assert.equal((await write(`${path}/pages/reorder`,{pageIds:invalid},'PUT')).status,400);
    assert.deepEqual((await (await localRequest(path)).json()).pages.map((page:{id:string})=>page.id),ids);
  }
  const exported=await exportLesson(notebook.id),manifest=JSON.parse(await exported.text());assert.deepEqual(manifest.pages.map((page:{id:string})=>page.id),ids);
  // Even external producers may list records out of order; positions are authoritative.
  manifest.pages.reverse();const imported=await importLesson(new Blob([JSON.stringify(manifest)]));
  const restored=await (await localRequest(`/api/notebooks/${imported}`)).json();
  assert.deepEqual(restored.pages.map((page:{objects:{text:string}[]})=>page.objects[0].text),['Slide 2','Slide 0','Slide 1']);
});

test('page creation after an import restores saved defaults and interface preferences persist',async()=>{
 const {localRequest}=await import('../src/lib/local-store');
 const image='data:image/png;base64,aGVsbG8=';
 await localRequest('/api/profile',{method:'PUT',body:JSON.stringify({boardBg:'#334455',boardPattern:'grid',boardImage:image,ui:{showTime:false,popupGap:12,flipToolsOnSwap:true}})});
 const {notebook}=await(await localRequest('/api/notebooks',{method:'POST',body:JSON.stringify({title:'Imported board'})})).json();
 const {pages}=await(await localRequest(`/api/notebooks/${notebook.id}`)).json();
 await localRequest(`/api/pages/${pages[0].id}`,{method:'PUT',body:JSON.stringify({background:'#ffffff',pattern:'none',backgroundImage:'',importFrame:{x:0,y:0,width:1280,height:720}})});
 const {page}=await(await localRequest(`/api/notebooks/${notebook.id}/pages`,{method:'POST',body:JSON.stringify({afterPageId:pages[0].id})})).json();
 assert.equal(page.background,'#334455');assert.equal(page.pattern,'grid');assert.equal(page.backgroundImage,image);
 const {profile}=await(await localRequest('/api/profile')).json();assert.equal(profile.ui.showTime,false);assert.equal(profile.ui.popupGap,12);assert.equal(profile.ui.flipToolsOnSwap,true);
});

test('lesson default view and bulk view apply propagate zoom and alignment across all pages', async () => {
  const old = (globalThis as any).localStorage;
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() { return store.size; },
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
  };
  try {
    const {savedLessonDefaultView,saveLessonDefaultView,applyViewToAllPages,isViewSyncEnabled,setViewSyncEnabled,savedPageView}=await import('../src/lib/work-journal');
    const lessonId='test-lesson-views';
    const pageIds=['p1','p2','p3','p4'];
    const masterView={tx:150,ty:80,scale:1.65};

    assert.equal(savedLessonDefaultView(lessonId), null);
    assert.equal(isViewSyncEnabled(lessonId), false);

    saveLessonDefaultView(lessonId, masterView);
    assert.deepEqual(savedLessonDefaultView(lessonId), masterView);

    applyViewToAllPages(lessonId, pageIds, masterView);
    for(const pid of pageIds){
      assert.deepEqual(savedPageView(pid), masterView);
    }

    setViewSyncEnabled(lessonId, true);
    assert.equal(isViewSyncEnabled(lessonId), true);
    setViewSyncEnabled(lessonId, false);
    assert.equal(isViewSyncEnabled(lessonId), false);

    const {savedLessonDefaultFrame,saveLessonDefaultFrame}=await import('../src/lib/work-journal');
    assert.equal(savedLessonDefaultFrame(lessonId), null);
    const masterFrame={x:120,y:40,width:1600,height:900};
    saveLessonDefaultFrame(lessonId, masterFrame);
    assert.deepEqual(savedLessonDefaultFrame(lessonId), masterFrame);
  } finally {
    (globalThis as any).localStorage = old;
  }
});

test('batch layout updates media and importFrame across multiple slides atomically', async () => {
  const {notebook}=await (await write('/api/notebooks',{title:'Batch slide layout'})).json();
  const path=`/api/notebooks/${notebook.id}`;
  await write(`${path}/pages`,{});
  await write(`${path}/pages`,{});
  const {pages}=await (await localRequest(path)).json();
  assert.equal(pages.length, 3);

  const targetFrame = {x: 100, y: 50, width: 1400, height: 800};
  const updates = pages.map((page: {id: string}, idx: number) => ({
    id: page.id,
    importFrame: targetFrame,
    media: [{
      id: `media-${idx}`,
      kind: 'pdf' as const,
      assetId: 'sample-doc',
      x: targetFrame.x,
      y: targetFrame.y,
      width: targetFrame.width,
      height: targetFrame.height,
      rotation: 0,
      pageNumber: idx + 1,
      numPages: 3,
    }],
  }));

  const res = await localRequest(`${path}/pages/layout`, {
    method: 'PUT',
    body: JSON.stringify({pages: updates}),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.pages.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(data.pages[i].importFrame, targetFrame);
    assert.equal(data.pages[i].media[0].width, 1400);
    assert.equal(data.pages[i].media[0].height, 800);
    assert.equal(data.pages[i].media[0].x, 100);
    assert.equal(data.pages[i].media[0].y, 50);
  }

  // Re-fetch from DB to verify durability
  const reopened = await (await localRequest(path)).json();
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(reopened.pages[i].importFrame, targetFrame);
    assert.equal(reopened.pages[i].media[0].width, 1400);
    assert.equal(reopened.pages[i].media[0].height, 800);
  }
});

