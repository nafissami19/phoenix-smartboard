/** Original Phoenix Smartboard artwork: no vendor graphics are included in the application. */
export function PenIllustration({kind,color='#39766b'}:{kind:string;color?:string}){
  const wood=kind==='pencil'||kind==='crayon'||kind==='oil-pastel'||kind==='charcoal',
        brush=(kind==='paint'||kind==='oil-paint'||kind==='chinese'||kind==='watercolor'),
        laser=kind==='laser',
        calligraphy=kind==='calligraphy',
        marker=kind==='marker',
        airbrush=kind==='airbrush',
        gel=kind==='gel';
  const bodyColor=laser?'#344457':airbrush?'#546e7a':kind==='charcoal'?'#26292b':gel?'#78909c':color;
  return <svg aria-hidden="true" viewBox="0 0 40 64" width="32" height="48" fill="none">
    <path d="M13 60V29h14v31" fill={bodyColor}/><path d="M14 29v31h3V29" fill="white" opacity=".3"/><path d="M24 29v31h3V29" fill="black" opacity=".2"/>
    <path d="M12 28h16v8H12z" fill={wood?color:'#c5ced1'}/><path d="M12 32h16" stroke="#76858c"/>
    {kind==='chalk'?<><path d="M13 28V9q7-4 14 0v19z" fill={color}/><path d="M16 12v12m5-13v15" stroke="white" opacity=".4"/></>:
     brush?<><path d="M12 28c-2-10 3-18 10-23-2 10 8 13 5 23z" fill={kind==='watercolor'?'#b8860b':kind==='chinese'?'#2b2b2b':'#c39a69'}/><path d="M17 26c-1-7 2-12 5-16" stroke={kind==='chinese'?'#111':'#71563e'} strokeWidth="1.5"/></>:
     laser?<><path d="M14 28V16h12v12" fill="#a6b7bf"/><path d="M17 16V10h6v6" fill={color||"#ee5b68"}/><path d="M20 2v4m-8 1 3 3m13-3-3 3" stroke={color||"#ee5b68"} strokeWidth="2" strokeLinecap="round"/></>:
     kind==='highlighter'?<path d="M12 28V14l16-5v19z" fill={color}/>:
     marker?<><path d="M13 28V11l14 4v13z" fill={color}/><path d="M15 28V14l4 1v13" fill="white" opacity=".35"/></>:
     calligraphy?<><path d="m14 28 6-22 6 22z" fill="#d4af37"/><path d="m17 28 3-15 3 15z" fill="#f3e5ab"/><circle cx="20" cy="18" r="1.5" fill="#2c3031"/><path d="M20 6v10" stroke="#2c3031" strokeWidth="1"/></>:
     kind==='charcoal'?<><path d="m13 28 3-21h8l3 21z" fill="#2d3134"/><path d="M17 7v21" stroke="#1c1f21" strokeWidth="1.5"/><path d="M15 12h4m3 6h4" stroke="#485054" strokeWidth="1"/></>:
     airbrush?<><path d="M16 28v-9l4-11 4 11v9z" fill="#a8b8c2"/><path d="M19.5 8V2h1v6" fill="#ee5b68"/><circle cx="14" cy="5" r=".9" fill={color}/><circle cx="26" cy="7" r="1" fill={color}/><circle cx="23" cy="3" r=".8" fill={color}/></>:
     gel?<><path d="m15 28 5-18 5 18z" fill="#90caf9" opacity=".45"/><path d="M19 14v14h2V14z" fill={color}/><path d="M18.5 10h3v4h-3z" fill="#b0bec5"/><circle cx="20" cy="8.5" r="1.5" fill="#cfd8dc"/><circle cx="20" cy="8.5" r=".8" fill={color}/></>:
     <><path d="m13 28 7-23 7 23z" fill={wood?'#e6c195':'#b3c4cb'}/><path d="m18 12 2-7 2 7" fill={wood?'#263a42':color}/>{kind==='crayon'&&<path d="M12 39h16v13H12z" fill="#fff0bf" opacity=".75"/>}</>}
    <path d="M13 60h14" stroke="currentColor" opacity=".4"/>
  </svg>;
}
