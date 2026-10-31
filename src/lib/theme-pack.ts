import {PHOENIX_CREDITS,CLASSIC_CREDITS,parseStoreCredits,type StoreCredits} from './store-credits';
import {validateBoardPresets,BOARD_PRESETS,type BoardPreset} from './board-presets';
export const THEME_SCHEMA='com.phoenix.smartboard.theme';
export const THEME_ICON_IDS=['pen','pencil','paint','chinese','crayon','stamp','highlighter','laser','eraser','select','hand','shapes','tools','menu','import','save','export','board','layers','plus','chevronLeft','chevronRight','undo','redo','text','flipHorizontal','penPreview','pencilPreview','paintPreview','chinesePreview','crayonPreview','stampPreview','highlighterPreview','laserPreview'] as const;
export type ThemeIconId=typeof THEME_ICON_IDS[number];
export type ThemePack={schema:string;version:1;id:string;name:string;credits?:StoreCredits;appearance?:'org-note3';attribution?:string;colors:{panel:string;surface:string;ink:string;muted:string;line:string;accent:string;base?:string};autoContrast:boolean;icons:Partial<Record<ThemeIconId,string>>;boards:BoardPreset[]};

export const BUILTIN_THEMES:ThemePack[]=[
  {schema:THEME_SCHEMA,version:1,id:'phoenix-ember',name:'Phoenix Ember',credits:PHOENIX_CREDITS,colors:{panel:'#1e2229',surface:'#272d37',ink:'#f7f7f8',muted:'#9aa0a6',line:'#3c4048',accent:'#0062ff',base:'#0a0a0c'},autoContrast:true,icons:{},boards:BOARD_PRESETS},
  {schema:THEME_SCHEMA,version:1,id:'phoenix-chalkboard',name:'Chalkboard Emerald',credits:PHOENIX_CREDITS,colors:{panel:'#183c2e',surface:'#1a4331',ink:'#f1f5f3',muted:'#a3c4b6',line:'#2d5e4a',accent:'#2a9d8f',base:'#0f261d'},autoContrast:true,icons:{},boards:[{id:'board-green',name:'Chalkboard green',background:'#1a4331',pattern:'none',ink:'#ffffff'},...BOARD_PRESETS]},
  {schema:THEME_SCHEMA,version:1,id:'phoenix-obsidian',name:'Obsidian Midnight',credits:PHOENIX_CREDITS,colors:{panel:'#111214',surface:'#1b1d22',ink:'#f2f5f7',muted:'#88929b',line:'#2f353e',accent:'#38bdf8',base:'#08090a'},autoContrast:true,icons:{},boards:BOARD_PRESETS},
  {schema:THEME_SCHEMA,version:1,id:'warm-ivory',name:'Warm Ivory Cream',credits:PHOENIX_CREDITS,colors:{panel:'#fbf5ed',surface:'#ebdcc9',ink:'#47322d',muted:'#8f6e66',line:'#d9c7b4',accent:'#a9746e',base:'#f3e9dc'},autoContrast:true,icons:{},boards:[{id:'board-cream',name:'Exam Ivory Cream',background:'#f3e9dc',pattern:'dots',ink:'#47322d'},...BOARD_PRESETS]},
  {schema:THEME_SCHEMA,version:1,id:'phoenix-paper',name:'Paper Classic',credits:PHOENIX_CREDITS,colors:{panel:'#f5f3ed',surface:'#e6e4dc',ink:'#253137',muted:'#58676e',line:'#a8b0ae',accent:'#e63946',base:'#edebe4'},autoContrast:true,icons:{},boards:BOARD_PRESETS},
  {schema:THEME_SCHEMA,version:1,id:'oxford-navy',name:'Oxford Navy',credits:PHOENIX_CREDITS,colors:{panel:'#131e35',surface:'#1a2948',ink:'#f0f4fc',muted:'#8fa4c7',line:'#24375d',accent:'#3b82f6',base:'#0c1322'},autoContrast:true,icons:{},boards:[{id:'board-navy',name:'Oxford Navy',background:'#131e35',pattern:'dots',ink:'#f0f4fc'},...BOARD_PRESETS]},
  {schema:THEME_SCHEMA,version:1,id:'nordic-slate',name:'Nordic Slate',credits:PHOENIX_CREDITS,colors:{panel:'#222730',surface:'#2b323e',ink:'#eceff4',muted:'#9aa5b8',line:'#384152',accent:'#88c0d0',base:'#1a1e24'},autoContrast:true,icons:{},boards:[{id:'board-nordic',name:'Nordic Slate',background:'#222730',pattern:'grid',ink:'#eceff4'},...BOARD_PRESETS]},
  {schema:THEME_SCHEMA,version:1,id:'sage-harmony',name:'Sage Harmony',credits:PHOENIX_CREDITS,colors:{panel:'#f7faf8',surface:'#dbe6dc',ink:'#203326',muted:'#56715f',line:'#b8ccbe',accent:'#2e7d4d',base:'#edf3ee'},autoContrast:true,icons:{},boards:[{id:'board-sage',name:'Sage Linen',background:'#edf3ee',pattern:'dots',ink:'#203326'},...BOARD_PRESETS]},
  {schema:THEME_SCHEMA,version:1,id:'classic-note',name:'Classic Board',credits:CLASSIC_CREDITS,appearance:'org-note3',colors:{panel:'#f5f5f3',surface:'#dededc',ink:'#25272a',muted:'#56595b',line:'#b6b9bb',accent:'#407db2',base:'#e8e8e5'},autoContrast:false,icons:{},boards:[{id:'note-green',name:'Note green',background:'#95c459',pattern:'none',ink:'#111111'},...BOARD_PRESETS]},
];

export function isLightTheme(theme?: ThemePack | null): boolean {
  if (!theme) return false;
  const hex = theme.colors.base || theme.colors.surface || theme.colors.panel;
  const rgb = hex.match(/[a-f\d]{2}/gi)?.map(c => parseInt(c, 16)) ?? [0, 0, 0];
  return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 >= 140;
}

export function isRasterData(value:unknown):value is string{return typeof value==='string'&&value.length<=750000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);}

export function parseThemePack(value:unknown):ThemePack{
  const v=value as Record<string,unknown>,colors=v.colors as ThemePack['colors'];
  if(v.schema!==THEME_SCHEMA||v.version!==1)throw new Error('Unsupported theme format or version.');
  if(typeof v.id!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>48)throw new Error('A theme needs a valid ID and name.');
  if(!colors||!['panel','surface','ink','muted','line','accent'].every(key=>/^#[a-f\d]{6}$/i.test(String(colors[key as keyof typeof colors]))))throw new Error('Theme colors must be six-digit hex colors.');
  if(colors.base!==undefined&&!/^#[a-f\d]{6}$/i.test(String(colors.base)))throw new Error('Theme colors must be six-digit hex colors.');
  const icons:ThemePack['icons']={};
  if(v.icons&&typeof v.icons==='object')for(const id of THEME_ICON_IDS){const icon=(v.icons as Record<string,unknown>)[id];if(icon!==undefined){if(!isRasterData(icon))throw new Error('Icons must be embedded PNG, JPEG or WebP images under 550 KB.');icons[id]=icon;}}
  if(v.appearance!==undefined&&v.appearance!=='org-note3')throw new Error('Unsupported theme appearance.');
  if(v.attribution!==undefined&&(typeof v.attribution!=='string'||v.attribution.length>1000))throw new Error('Invalid theme attribution.');
  const credits=parseStoreCredits(v.credits);
  const boards=validateBoardPresets(v.boards);
  if(!Array.isArray(v.boards)||boards.length!==v.boards.length)throw new Error('The theme contains an invalid board preset.');
  const resultColors: ThemePack['colors'] = {
    panel: colors.panel,
    surface: colors.surface,
    ink: colors.ink,
    muted: colors.muted,
    line: colors.line,
    accent: colors.accent,
  };
  if (typeof colors.base === 'string' && /^#[a-f\d]{6}$/i.test(colors.base)) {
    resultColors.base = colors.base;
  }
  const result:ThemePack={schema:THEME_SCHEMA,version:1,id:v.id,name:v.name.trim(),colors:resultColors,autoContrast:v.autoContrast!==false,icons,boards};
  if(credits)result.credits=credits;
  if(v.appearance==='org-note3')result.appearance='org-note3';
  if(typeof v.attribution==='string')result.attribution=v.attribution;
  if(JSON.stringify(result).length>6*1024*1024)throw new Error('Theme packs must be under 6 MB.');return result;
}

export function controlContrast(background:string){const rgb=background.match(/[a-f\d]{2}/gi)?.map(c=>parseInt(c,16))??[0,0,0];return rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>145?{panel:'#253137',ink:'#f5f7f4',line:'#697a80'}:{panel:'#f5f3ed',ink:'#253137',line:'#a8b0ae'};}

/** Keep lossless artwork when it fits; otherwise compress, then reduce dimensions. */
export function fitThemeRaster(canvas:Pick<HTMLCanvasElement,'width'|'height'|'toDataURL'>,draw:(width:number,height:number)=>void,width:number,height:number):string{
  for(let attempt=0;attempt<16;attempt++){
    canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
    draw(canvas.width,canvas.height);
    const png=canvas.toDataURL('image/png');if(isRasterData(png))return png;
    for(const quality of [.9,.78,.62,.45]){const result=canvas.toDataURL('image/webp',quality);if(isRasterData(result))return result;}
    if(canvas.width===1&&canvas.height===1)break;
    width*=.72;height*=.72;
  }
  throw new Error('This image could not be prepared. Try another PNG, JPEG or WebP.');
}

export async function themeImage(file:File,maxWidth=1280,maxHeight=720):Promise<string>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPEG or WebP image.');
  if(file.size>64*1024*1024)throw new Error('Choose an image under 64 MB. Larger images may exceed this device memory.');
  const image=new Image(),url=URL.createObjectURL(file);
  try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('The image could not be read.'));image.src=url;});
    if(!image.naturalWidth||!image.naturalHeight)throw new Error('The image has invalid dimensions.');
    const scale=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight),canvas=document.createElement('canvas');
    return fitThemeRaster(canvas,(width,height)=>{const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable.');ctx.drawImage(image,0,0,width,height);},image.naturalWidth*scale,image.naturalHeight*scale);
  }finally{image.src='';URL.revokeObjectURL(url);}
}

export function controlPalette(theme:ThemePack,background:string){
 const panel=theme.colors.panel.match(/[a-f\d]{2}/gi)?.map(v=>parseInt(v,16))??[0,0,0];
 if(theme.autoContrast&&panel[0]*.299+panel[1]*.587+panel[2]*.114>=128)return controlContrast(background);
 return{panel:theme.colors.panel,ink:theme.colors.ink,line:theme.colors.line};
}

/** Older local Note3 packs accidentally used the drawing arrow as Select. */
export function themeIconSource(theme:ThemePack|undefined,id:ThemeIconId):string|undefined{
 const source=theme?.icons[id];
 if(id==='select'&&theme?.appearance==='org-note3'&&source?.length===3254){
  let hash=2166136261;for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619)>>>0;
  if(hash===413514880)return undefined;
 }
 return source;
}
