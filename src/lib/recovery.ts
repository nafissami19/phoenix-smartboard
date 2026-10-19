import {openDB} from 'idb';
import {exportLesson} from './lesson-bundle';
type Snapshot={id:string;lessonId:string;savedAt:number;blob:Blob};
type WritableFile={write:(data:Blob)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>};
export type BackupDirectory={name:string;queryPermission:(options:{mode:'readwrite'})=>Promise<string>;requestPermission:(options:{mode:'readwrite'})=>Promise<string>;getFileHandle:(name:string,options:{create:boolean})=>Promise<{createWritable:()=>Promise<WritableFile>}>};
const recoveryDB=async()=>{
  const db = await openDB('phoenix-smartboard-recovery',1,{upgrade(db){db.createObjectStore('snapshots',{keyPath:'id'});db.createObjectStore('settings');}});
  try {
    const existing = await db.get('settings', 'targets');
    if (!existing && typeof indexedDB !== 'undefined' && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      if (dbs.some(d => d.name === 'kopy-notes-recovery')) {
        const oldDb = await openDB('kopy-notes-recovery', 1);
        const oldSnapshots = await oldDb.getAll('snapshots');
        for (const s of oldSnapshots) await db.put('snapshots', s);
        const oldTargets = await oldDb.get('settings', 'targets');
        if (oldTargets) await db.put('settings', oldTargets, 'targets');
        oldDb.close();
      }
    }
  } catch {}
  return db;
};
export async function snapshots(lessonId?:string):Promise<Snapshot[]>{const db=await recoveryDB();try{return (await db.getAll('snapshots')).filter((s:Snapshot)=>(!lessonId||s.lessonId===lessonId)).sort((a:Snapshot,b:Snapshot)=>b.savedAt-a.savedAt);}finally{db.close();}}
export type BackupTarget={label:string;directory:BackupDirectory};
export async function backupTargets():Promise<BackupTarget[]>{const db=await recoveryDB();try{const targets=await db.get('settings','targets');if(targets)return targets;const old=await db.get('settings','directory');return old?[{label:'Local folder',directory:old}]:[];}finally{db.close();}}
export async function backupDirectory(label='Local folder'){return (await backupTargets()).find(target=>target.label===label)?.directory;}
export async function removeBackupTarget(label:string){const targets=(await backupTargets()).filter(target=>target.label!==label),db=await recoveryDB();try{await db.put('settings',targets,'targets');}finally{db.close();}}
export async function chooseBackupDirectory(label='Local folder'){
 const picker=(window as unknown as {showDirectoryPicker?: (options:{mode:string;id:string})=>Promise<BackupDirectory>}).showDirectoryPicker;
 if(!picker)throw new Error('Automatic folder backup needs desktop Chrome or Edge. Use Download backup on this device.');
 const directory=await picker.call(window,{mode:'readwrite',id:'phoenix-'+label.toLowerCase().replace(/[^a-z0-9]/g,'-')});
 const targets=(await backupTargets()).filter(target=>target.label!==label);targets.push({label,directory});const db=await recoveryDB();try{await db.put('settings',targets,'targets');}finally{db.close();}return directory;
}
let queue:Promise<unknown>=Promise.resolve();
export function saveRecovery(lessonId:string):Promise<{external:boolean;savedAt:number;targets:{label:string;ok:boolean;message:string}[]}> {
 const run=queue.catch(()=>{}).then(async()=>{
  const blob=await exportLesson(lessonId), savedAt=Date.now(), db=await recoveryDB();
  try {
   const tx=db.transaction('snapshots','readwrite'), all=(await tx.store.getAll()).filter((s:Snapshot)=>s.lessonId===lessonId).sort((a:Snapshot,b:Snapshot)=>b.savedAt-a.savedAt);
   await tx.store.put({id:crypto.randomUUID(),lessonId,savedAt,blob});for(const old of all.slice(2))await tx.store.delete(old.id);await tx.done;
   const generation=(await db.get('settings',`generation:${lessonId}`) as number|undefined)??0;
   const results:{label:string;ok:boolean;message:string}[]=[];
   for(const {label,directory:dir} of await backupTargets()){
    try{
     if(await dir.queryPermission({mode:'readwrite'})!=='granted'){results.push({label,ok:false,message:'Re-enable folder permission'});continue;}
     const file=await dir.getFileHandle(`phoenix-${lessonId}-backup-${generation%3+1}.ps`,{create:true}),writable=await file.createWritable();
     try{await writable.write(blob);await writable.close();}catch(error){await writable.abort().catch(()=>{});throw error;}
     results.push({label,ok:true,message:'File saved; check your provider app for upload status'});
    }catch(error){results.push({label,ok:false,message:error instanceof Error?error.message:'Folder write failed'});}
   }
   if(results.some(result=>result.ok))await db.put('settings',generation+1,`generation:${lessonId}`);
   return {external:results.some(result=>result.ok),savedAt,targets:results};
  }finally{db.close();}
 });queue=run;return run;
}
