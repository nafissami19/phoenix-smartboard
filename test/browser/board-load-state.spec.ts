import {test,expect,type Page} from '@playwright/test';

async function seed(page:Page,withPage:boolean){
  await page.goto('/#/app');await page.getByRole('button',{name:'Start teaching',exact:true}).waitFor();
  await page.evaluate(async(withPage)=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('phoenix-smartboard-db',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction(['profile','notebooks','pages'],'readwrite');const now=new Date();
    tx.objectStore('profile').put({id:1,appName:'Phoenix Smartboard',teacherName:'Teacher',institution:'',accent:'#526677',boardBg:'#ffffff',boardPattern:'none',defaultPenColor:'#10151b',ui:{toolPopupOnFirstClick:true},onboarded:1,createdAt:now,updatedAt:now});
    tx.objectStore('notebooks').put({id:'empty-lesson',title:'Empty lesson',subject:'General',coverColor:'#526677',pageCount:0,createdAt:now,updatedAt:now});
    if(withPage)tx.objectStore('pages').put({id:'empty-page',notebookId:'empty-lesson',position:0,background:'#ffffff',pattern:'none',objects:[],media:[],createdAt:now,updatedAt:now});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },withPage);
}

test('a missing lesson offers retry and a way back instead of loading forever',async({page})=>{
  await seed(page,true);
  await page.goto('/#/board/does-not-exist');
  await expect(page.getByRole('heading',{name:'This lesson could not be opened'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry'})).toBeVisible();
  await page.getByRole('button',{name:'Back to library'}).click();
  await expect(page).toHaveURL(/#\/library/);
});

test('a lesson without slides gets a first slide so strokes are saved',async({page})=>{
  await seed(page,false);
  await page.goto('/#/board/empty-lesson');
  await expect(page.getByRole('button',{name:'Pen',exact:true})).toBeVisible({timeout:60000});
  await page.mouse.move(450,250);await page.mouse.down();await page.mouse.move(590,340,{steps:12});await page.mouse.up();
  await expect.poll(()=>page.evaluate(async()=>{const {localRequest}=await import('/src/lib/local-store.ts' as string);const {pages}=await(await localRequest('/api/notebooks/empty-lesson')).json();return pages.length===1?pages[0].objects.filter((o:{kind:string})=>o.kind==='stroke').length:-pages.length;}),{timeout:10000}).toBe(1);
});
