const path=require('node:path');
const fs=require('node:fs/promises');
const {screen,desktopCapturer}=require('electron');
function install({app,BrowserWindow,ipcMain,getMain,getFolder}){
 let overlay,controls,active=false,closing=false,saveTimer;
 let state={mode:'mouse',color:'#ff4b57',width:5,tool:'pen',revision:0};
 let strokes=[],undo=[],redo=[],display;
 const preferences={contextIsolation:true,nodeIntegration:false,sandbox:true,preload:path.join(__dirname,'preload.cjs')};
 const allowed=sender=>[getMain(),overlay,controls].some(w=>w&&!w.isDestroyed()&&w.webContents===sender);
 const send=()=>{for(const w of [overlay,controls])if(w&&!w.isDestroyed()){w.webContents.send('phoenix-display-state',{...state,strokes});}};
 const save=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const folder=path.join(getFolder(),'Annotations');void fs.mkdir(folder,{recursive:true}).then(()=>fs.writeFile(path.join(folder,'last-session.json.pending'),JSON.stringify({format:'phoenix-display',version:1,strokes}))).then(()=>fs.rename(path.join(folder,'last-session.json.pending'),path.join(folder,'last-session.json'))).catch(()=>{});},500);};
 const keepControlsOnTop=()=>{
  if(controls&&!controls.isDestroyed()){
   controls.setAlwaysOnTop(true,'pop-up-menu');
   controls.moveTop();
  }
 };
 const reframe=()=>{if(!active)return;const next=screen.getAllDisplays().find(d=>d.id===display.id)||screen.getPrimaryDisplay();display=next;if(overlay&&!overlay.isDestroyed())overlay.setBounds(next.bounds);if(controls&&!controls.isDestroyed())controls.setPosition(next.workArea.x+Math.max(0,Math.round((next.workArea.width-controls.getBounds().width)/2)),next.workArea.y+next.workArea.height-controls.getBounds().height-8);};
 function close(restore=true){
  if(closing)return;
  closing=true;
  active=false;
  screen.removeListener('display-metrics-changed',reframe);
  screen.removeListener('display-removed',reframe);
  for(const w of [overlay,controls])if(w&&!w.isDestroyed())w.close();
  overlay=controls=undefined;
  if(restore&&getMain()&&!getMain().isDestroyed()){getMain().restore();getMain().show();getMain().focus();}
  closing=false;
 }
 async function start(){
  const main=getMain();if(!main||main.isDestroyed())return;
  if(active){controls?.show();keepControlsOnTop();return;}
  if(!strokes.length){
   try{
    const saved=JSON.parse(await fs.readFile(path.join(getFolder(),'Annotations','last-session.json'),'utf8'));
    if(saved.format==='phoenix-display'&&saved.version===1&&Array.isArray(saved.strokes)&&saved.strokes.length<=2000)strokes=saved.strokes.filter(s=>['pen','marker','line','rect','ellipse'].includes(s.tool)&&/^#[a-f0-9]{6}$/i.test(s.color)&&Number.isFinite(s.width)&&Array.isArray(s.points)&&s.points.length<=20000&&s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
   }catch{}
  }
  display=screen.getDisplayMatching(main.getBounds());
  const area=display.bounds;
  overlay=new BrowserWindow({x:area.x,y:area.y,width:area.width,height:area.height,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,skipTaskbar:true,hasShadow:false,show:false,webPreferences:preferences});
  controls=new BrowserWindow({x:Math.max(area.x,area.x+Math.round((area.width-680)/2)),y:Math.max(display.workArea.y,display.workArea.y+display.workArea.height-100),width:Math.min(680,area.width-16),height:92,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,skipTaskbar:true,alwaysOnTop:true,show:false,webPreferences:preferences});
  overlay.setAlwaysOnTop(true,'screen-saver');
  controls.setAlwaysOnTop(true,'pop-up-menu');
  for(const w of [overlay,controls]){
   w.setMenuBarVisibility(false);
   w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   w.webContents.on('will-navigate',event=>event.preventDefault());
   w.on('closed',()=>{if(active)close();});
  }
  overlay.setIgnoreMouseEvents(true,{forward:true});
  state={...state,mode:'mouse'};
  await Promise.all([overlay.loadFile(path.join(__dirname,'annotation.html')),controls.loadFile(path.join(__dirname,'annotation-controls.html'))]);
  active=true;
  screen.on('display-metrics-changed',reframe);
  screen.on('display-removed',reframe);
  overlay.showInactive();
  controls.show();
  keepControlsOnTop();
  main.minimize();
  send();
  return {active:true};
 }
 const handleStart=event=>{if(event.sender!==getMain()?.webContents)throw new Error('Open display annotation from Phoenix Smartboard.');return start();};
 ipcMain.handle('phoenix-display-start',handleStart);
 const handleCommand=async(event,action,value)=>{
  if(!allowed(event.sender))throw new Error('Unknown annotation window.');
  if(action==='state'){send();return {...state,strokes};}
  if(!active)return;
  if(action==='return'){close();return;}
  if(action==='collapse'){
    const collapsed=Boolean(value);
    if(controls&&!controls.isDestroyed()){
      const b=controls.getBounds();
      if(collapsed){
        controls.setBounds({x:b.x+b.width-68,y:b.y,width:68,height:68});
      }else{
        const area=display.bounds;
        const targetW=Math.min(680,area.width-16);
        const targetX=Math.max(area.x,b.x+b.width-targetW);
        controls.setBounds({x:targetX,y:b.y,width:targetW,height:92});
      }
      keepControlsOnTop();
    }
    return;
  }
  if(action==='mode'&&['mouse','draw'].includes(value)){
   state.mode=value;
   overlay.setIgnoreMouseEvents(value==='mouse',{forward:true});
   if(value==='draw'){overlay.focus();keepControlsOnTop();}
  }
  else if(action==='tool'&&['pen','marker','eraser','line','rect','ellipse','laser'].includes(value)){
   state.tool=value;
   state.mode='draw';
   overlay.setIgnoreMouseEvents(false);
   overlay.focus();
   keepControlsOnTop();
  }
  else if(action==='color'&&typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value))state.color=value;
  else if(action==='width'&&Number.isFinite(value))state.width=Math.max(1,Math.min(40,value));
  else if(action==='stroke'&&value&&['pen','marker','line','rect','ellipse','laser'].includes(value.tool)&&/^#[a-f0-9]{6}$/i.test(value.color)&&Number.isFinite(value.width)&&Array.isArray(value.points)&&value.points.length<=20000&&value.points.length>0&&value.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<100000&&Math.abs(p.y)<100000)){
   undo.push(strokes);undo=undo.slice(-50);redo=[];strokes=[...strokes.slice(-1999),{...value,id:require('node:crypto').randomUUID(),width:Math.max(1,Math.min(40,value.width)),createdAt:Date.now()}];state.revision++;save();
  }else if(action==='erase'&&Array.isArray(value)&&value.length<=2000){undo.push(strokes);redo=[];strokes=strokes.filter(s=>!value.includes(s.id));state.revision++;save();}
  else if(action==='undo'&&undo.length){redo.push(strokes);strokes=undo.pop();state.revision++;save();}
  else if(action==='redo'&&redo.length){undo.push(strokes);strokes=redo.pop();state.revision++;save();}
  else if(action==='clear'){undo.push(strokes);redo=[];strokes=[];state.revision++;save();}
  else if(action==='capture'){
   controls.hide();try{await new Promise(resolve=>setTimeout(resolve,180));const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:display.size.width*display.scaleFactor,height:display.size.height*display.scaleFactor}});const source=sources.find(s=>s.display_id===String(display.id))||sources[0];if(!source||source.thumbnail.isEmpty())throw new Error('Screen capture unavailable.');const folder=path.join(getFolder(),'Annotations');await fs.mkdir(folder,{recursive:true});const name=`display-${Date.now()}.png`;await fs.writeFile(path.join(folder,name),source.thumbnail.toPNG());return {saved:true,name};}finally{controls?.show();keepControlsOnTop();}
  }send();
 };
 ipcMain.handle('phoenix-display-command',handleCommand);
 return {close:()=>close(false)};
}
module.exports={install};