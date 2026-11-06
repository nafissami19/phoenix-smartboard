import type {AppProfile} from '../db/schema';
import {BRANDING} from '@/config/branding';
import {BUILTIN_THEMES} from './theme-pack';

/** The one default profile used by the local store and the React context. */
export const DEFAULT_PROFILE: AppProfile = {
  id: 1,
  appName: BRANDING.APP_NAME,
  teacherName: '',
  institution: '',
  accent: BRANDING.COLORS.PRIMARY,
  boardBg: '#18212b',
  boardPattern: 'dots',
  defaultPenColor: '#f4f4f5',
  onboarded: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  splashText: BRANDING.APP_SLOGAN
};

/** Profiles saved by older releases used a green chalkboard; move them to the current dark board. */
export function withCurrentBoard<T extends Partial<AppProfile>>(profile: T): T {
  const legacy = !profile.boardBg || profile.boardBg === BRANDING.COLORS.CHALKBOARD_GREEN || profile.boardBg === '#83d131';
  return legacy ? {...profile, boardBg: '#18212b', boardPattern: profile.boardPattern === 'none' ? 'dots' : (profile.boardPattern || 'dots'), defaultPenColor: profile.defaultPenColor === '#ffffff' ? '#f4f4f5' : (profile.defaultPenColor || '#f4f4f5')} : profile;
}

/** Releases before 1.1 defaulted to Electric Blue; move the untouched default (and the stock Ember pack) to Phoenix Crimson. */
const OLD_DEFAULT_ACCENT = '#0062ff';
export function withCurrentBrand<T extends Partial<AppProfile>>(profile: T): T {
  let next = profile;
  if (typeof next.accent === 'string' && next.accent.toLowerCase() === OLD_DEFAULT_ACCENT) next = {...next, accent: BRANDING.COLORS.PRIMARY};
  const ember = BUILTIN_THEMES.find(theme => theme.id === 'phoenix-ember');
  if (ember && next.theme?.id === 'phoenix-ember' && next.theme.colors?.accent?.toLowerCase() === OLD_DEFAULT_ACCENT) next = {...next, theme: {...next.theme, colors: {...ember.colors}}};
  return next;
}

/** Fill missing fields, apply the legacy board and brand migrations and revive JSON dates. */
export function normalizeProfile(profile: Partial<AppProfile> | undefined): AppProfile {
  const merged = withCurrentBrand(withCurrentBoard({...DEFAULT_PROFILE, ...profile}));
  return {...merged, createdAt: new Date(profile?.createdAt ?? 0), updatedAt: new Date(profile?.updatedAt ?? 0)};
}
