export type StoreCredits={author:string;addedBy:string;license?:string;source?:string;origin?:string};
export const PHOENIX_CREDITS:StoreCredits={author:'Phoenix Smartboard Team',addedBy:'Phoenix Smartboard',license:'MIT',source:'https://github.com/phoenix-smartboard/phoenix-smartboard'};
export const CLASSIC_CREDITS:StoreCredits={author:'Classic Board Theme',addedBy:'Phoenix Smartboard',license:'Open Source',origin:'Classic classroom tools layout'};
export const NOTE3_CREDITS = CLASSIC_CREDITS; // backward-compat alias
export function parseStoreCredits(value:unknown):StoreCredits|undefined{
 if(value===undefined)return undefined;if(!value||typeof value!=='object')throw new Error('Invalid creator credits.');const v=value as Record<string,unknown>;
 for(const key of ['author','addedBy'])if(typeof v[key]!=='string'||!(v[key] as string).trim()||(v[key] as string).length>120)throw new Error('Creator and added-by names must be 1 to 120 characters.');
 for(const key of ['license','origin'])if(v[key]!==undefined&&(typeof v[key]!=='string'||(v[key] as string).length>250))throw new Error('Invalid artwork credits.');
 if(v.source!==undefined){if(typeof v.source!=='string'||v.source.length>500)throw new Error('Invalid source link.');const url=new URL(v.source);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Use a public HTTP or HTTPS source link.');}
 return {author:(v.author as string).trim(),addedBy:(v.addedBy as string).trim(),...(typeof v.license==='string'?{license:v.license}:{}),...(typeof v.origin==='string'?{origin:v.origin}:{}),...(typeof v.source==='string'?{source:v.source}:{})};
}
