import {openDB} from 'idb';
import type {Page} from '../db/schema';
export type PageEdit=Pick<Page,'objects'|'media'|'background'|'pattern'|'backgroundImage'|'importFrame'>;
export type EditCheckpoint={pageId:string;lessonId:string;revision:string;savedAt:number;edit:PageEdit;partial:boolean};
export type WorkSession={lessonId:string;pageId:string;title:string;active:boolean;updatedAt:number;activity?:string};
const journal=()=>openDB('phoenix-smartboard-work-journal',1,{upgrade(db){db.createObjectStore('edits',{keyPath:'pageId'});db.createObjectStore('sessions',{keyPath:'lessonId'});}});
// Transactions are ordered; an older completed save cannot remove a newer draft.
let editsQueue:Promise<unknown>=Promise.resolve();
export function checkpoint(edit:EditCheckpoint,options:{detached?:boolean}={}){if(!options.detached)edit=structuredClone(edit);const run=editsQueue.catch(()=>{}).then(async()=>{const db=await journal();try{const tx=db.transaction('edits','readwrite',{durability:'strict'});await tx.store.put(edit);await tx.done;}finally{db.close();}});editsQueue=run;return run;}
export function acknowledge(pageId:string,revision:string){const run=editsQueue.catch(()=>{}).then(async()=>{const db=await journal();try{const tx=db.transaction('edits','readwrite',{durability:'strict'}),current=await tx.store.get(pageId);if(current?.revision===revision)await tx.store.delete(pageId);await tx.done;}finally{db.close();}});editsQueue=run;return run;}
export async function unfinishedEdits(lessonId:string):Promise<EditCheckpoint[]>{const db=await journal();try{return(await db.getAll('edits')).filter((edit:EditCheckpoint)=>edit.lessonId===lessonId).sort((a,b)=>b.savedAt-a.savedAt);}finally{db.close();}}
export async function recordSession(session:WorkSession){const db=await journal();try{const tx=db.transaction('sessions','readwrite');const previous=await tx.store.get(session.lessonId);await tx.store.put({...previous,...session});await tx.done;}finally{db.close();}}
export async function finishSession(lessonId:string){const db=await journal();try{const tx=db.transaction('sessions','readwrite'),current=await tx.store.get(lessonId);if(current)await tx.store.put({...current,active:false});await tx.done;}finally{db.close();}}
export async function interruptedSessions():Promise<WorkSession[]>{const db=await journal();try{const edits=await db.getAll('edits');return(await db.getAll('sessions')).filter((s:WorkSession)=>s.active||edits.some((e:EditCheckpoint)=>e.lessonId===s.lessonId)).sort((a,b)=>b.updatedAt-a.updatedAt);}finally{db.close();}}
export function savedPageView(pageId:string){try{const v=JSON.parse(localStorage.getItem('phoenix-view:'+pageId)??localStorage.getItem('kopy-view:'+pageId)??'null');if(v&&[v.tx,v.ty,v.scale].every(Number.isFinite)&&v.scale>=.15&&v.scale<=8)return v as {tx:number;ty:number;scale:number};}catch{}return null;}
export function savedLessonDefaultView(lessonId:string):{tx:number;ty:number;scale:number}|null{try{const v=JSON.parse(localStorage.getItem('phoenix-default-view:'+lessonId)??localStorage.getItem('kopy-default-view:'+lessonId)??'null');if(v&&[v.tx,v.ty,v.scale].every(Number.isFinite)&&v.scale>=.15&&v.scale<=8)return v as {tx:number;ty:number;scale:number};}catch{}return null;}
export function saveLessonDefaultView(lessonId:string,view:{tx:number;ty:number;scale:number}){try{localStorage.setItem('phoenix-default-view:'+lessonId,JSON.stringify(view));}catch{}}
export function applyViewToAllPages(lessonId:string,pageIds:string[],view:{tx:number;ty:number;scale:number}){saveLessonDefaultView(lessonId,view);for(const pid of pageIds){try{localStorage.setItem('phoenix-view:'+pid,JSON.stringify(view));}catch{}}}
export function isViewSyncEnabled(lessonId:string):boolean{try{return (localStorage.getItem('phoenix-sync-view:'+lessonId)??localStorage.getItem('kopy-sync-view:'+lessonId))==='true';}catch{return false;}}
export function setViewSyncEnabled(lessonId:string,enabled:boolean){try{localStorage.setItem('phoenix-sync-view:'+lessonId,String(enabled));}catch{}}
export type DefaultFrame = {x:number;y:number;width:number;height:number};
export function savedLessonDefaultFrame(lessonId:string):DefaultFrame|null{try{const f=JSON.parse(localStorage.getItem('phoenix-default-frame:'+lessonId)??localStorage.getItem('kopy-default-frame:'+lessonId)??'null');if(f&&[f.x,f.y,f.width,f.height].every(Number.isFinite)&&f.width>0&&f.height>0)return f as DefaultFrame;}catch{}return null;}
export function saveLessonDefaultFrame(lessonId:string,frame:DefaultFrame){try{localStorage.setItem('phoenix-default-frame:'+lessonId,JSON.stringify(frame));}catch{}}

export async function setWorkActivity(lessonId:string,activity?:string){const db=await journal();try{const tx=db.transaction('sessions','readwrite',{durability:'strict'});const current=await tx.store.get(lessonId);await tx.store.put({...current,lessonId,activity,active:true,updatedAt:Date.now()});await tx.done;}finally{db.close();}}
export async function lastWorkActivity(lessonId:string):Promise<string|undefined>{const db=await journal();try{return(await db.get('sessions',lessonId))?.activity;}finally{db.close();}}

