import type {AppProfile} from '../db/schema';
import {BRANDING} from '@/config/branding';
import {BUILTIN_THEMES} from './theme-pack';

/** Default pen: Phoenix red, readable on the dark board and on white pages. */
export const DEFAULT_PEN_COLOR = '#f43f5e';
/** The one default profile used by the local store and the React context. */
export const DEFAULT_PROFILE: AppProfile = {
  id: 1,
  appName: BRANDING.APP_NAME,
  teacherName: '',
  institution: '',
  accent: BRANDING.COLORS.PRIMARY,
  boardBg: '#18212b',
  boardPattern: 'dots',
  defaultPenColor: DEFAULT_PEN_COLOR,
  onboarded: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  splashText: BRANDING.APP_SLOGAN
};

/** Profiles saved by older releases used a green chalkboard; move them to the current dark board. */
export function withCurrentBoard<T extends Partial<AppProfile>>(profile: T): T {
  const legacy = !profile.boardBg || profile.boardBg === BRANDING.COLORS.CHALKBOARD_GREEN || profile.boardBg === '#83d131';
  return legacy ? {...profile, boardBg: '#18212b', boardPattern: profile.boardPattern === 'none' ? 'dots' : (profile.boardPattern || 'dots'), defaultPenColor: profile.defaultPenColor || DEFAULT_PEN_COLOR} : profile;
}

/** Releases before 1.1 defaulted to Electric Blue; move the untouched default (and the stock Ember pack) to Phoenix Crimson. */
const OLD_DEFAULT_ACCENT = '#0062ff';
const OLD_DEFAULT_PENS = ['#f4f4f5'];
export function withCurrentBrand<T extends Partial<AppProfile>>(profile: T): T {
  let next = profile;
  if (typeof next.accent === 'string' && next.accent.toLowerCase() === OLD_DEFAULT_ACCENT) next = {...next, accent: BRANDING.COLORS.PRIMARY};
  // The old default pen was off-white; teachers who never changed it get the new red default.
  if (typeof next.defaultPenColor === 'string' && OLD_DEFAULT_PENS.includes(next.defaultPenColor.toLowerCase())) next = {...next, defaultPenColor: DEFAULT_PEN_COLOR};
  const ember = BUILTIN_THEMES.find(theme => theme.id === 'phoenix-ember');
  if (ember && next.theme?.id === 'phoenix-ember' && next.theme.colors?.accent?.toLowerCase() === OLD_DEFAULT_ACCENT) next = {...next, theme: {...next.theme, colors: {...ember.colors}}};
  return next;
}

/** Fill missing fields, apply the legacy board and brand migrations and revive JSON dates. */
export function normalizeProfile(profile: Partial<AppProfile> | undefined): AppProfile {
  const merged = withCurrentBrand(withCurrentBoard({...DEFAULT_PROFILE, ...profile}));
  return {...merged, createdAt: new Date(profile?.createdAt ?? 0), updatedAt: new Date(profile?.updatedAt ?? 0)};
}
