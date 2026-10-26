import type {AppProfile,Page} from '../db/schema';
export function newPageStyle(profile:Partial<AppProfile>,previous?:Pick<Page,'background'|'pattern'|'backgroundImage'|'importFrame'|'media'>){
 const imported=!!previous?.importFrame||!!previous?.media.length;
 return{background:!imported&&previous?previous.background:profile.boardBg??'#18212b',pattern:!imported&&previous?previous.pattern:profile.boardPattern??'dots',backgroundImage:!imported&&previous?previous.backgroundImage:profile.boardImage};
}
