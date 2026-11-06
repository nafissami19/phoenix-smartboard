import {useCallback} from 'react';

const loaded=(img:HTMLImageElement)=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Print image failed to load'));});

/**
 * Prints page images through a hidden same-origin iframe. Unlike window.open this
 * works under Electron's setWindowOpenHandler and waits for every image to decode
 * so the print preview is never blank.
 */
export async function printImages(urls:string[],title='Lesson'){
  const frame=document.createElement('iframe');
  frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.title='Print preview';
  frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  let removed=false,timer=0;
  const remove=()=>{if(removed)return;removed=true;window.clearTimeout(timer);frame.remove();};
  try{
    const win=frame.contentWindow,doc=frame.contentDocument;
    if(!win||!doc)throw new Error('Printing is not available');
    doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><title></title><style>@page{margin:0}html,body{margin:0;background:#fff}img{display:block;width:100%;break-after:page}img:last-child{break-after:auto}</style></head><body></body></html>');doc.close();
    doc.title=title;
    const images=urls.map(src=>{const img=doc.createElement('img');img.alt='';img.src=src;doc.body.appendChild(img);return img;});
    await Promise.all(images.map(img=>typeof img.decode==='function'?img.decode().catch(()=>loaded(img)):loaded(img)));
    win.addEventListener('afterprint',remove,{once:true});
    // Some engines never fire afterprint (or print() returns immediately); clean up anyway.
    timer=window.setTimeout(remove,60_000);
    win.focus();win.print();
  }catch(error){remove();throw error;}
}

export function usePrint(renderToCanvas:()=>HTMLCanvasElement|null,push:(message:string,kind?:'success'|'error'|'info')=>void,title?:string){
  return useCallback(async()=>{
    const canvas=renderToCanvas();
    if(!canvas)return;
    const url=canvas.toDataURL('image/png');canvas.width=canvas.height=0;
    try{await printImages([url],title);}catch{push('Could not open the print dialog. Export a PDF instead.','error');}
  },[renderToCanvas,push,title]);
}
