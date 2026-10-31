import {initializeDisplay} from './smartboard';
import {interfaceSettings} from './interface-settings';
"use client";
import {BUILTIN_THEMES,parseThemePack,isLightTheme,type ThemePack} from './theme-pack';
import { localRequest } from "@/lib/local-store";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { AppProfile } from "@/db/schema";
import { BRANDING } from '@/config/branding';
declare global {interface Window {phoenixStartup?:{ready:()=>void;retry:()=>void};}}

const DEFAULT_PROFILE: AppProfile = {
  id: 1,
  appName: BRANDING.APP_NAME,
  teacherName: "",
  institution: "",
  accent: BRANDING.COLORS.PRIMARY,
  boardBg: "#18212b",
  boardPattern: "dots",
  defaultPenColor: "#f4f4f5",
  onboarded: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  splashText: BRANDING.APP_SLOGAN,
};

type AppContextValue = {
  profile: AppProfile;
  loading: boolean;
  updateProfile: (patch: Partial<AppProfile>) => Promise<void>;
  reload: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(()=>{void initializeDisplay().catch(()=>{});},[]);
  const [storedProfile, setProfile] = useState<AppProfile>(DEFAULT_PROFILE);
  const [previewTheme,setPreviewTheme]=useState<ThemePack|null>(()=>import.meta.env.DEV&&new URLSearchParams(location.search).get('theme')==='org-note3'?BUILTIN_THEMES.find(theme=>theme.id==='org-note3')!:null);
  const profile=previewTheme?{...storedProfile,theme:previewTheme,accent:previewTheme.colors.accent}:storedProfile;
  useEffect(()=>{
    if(!import.meta.env.DEV)return;
    let mounted=true;
    void fetch('/__local-note3-theme').then(async response=>{
      if(response.status!==200)return;const pack=await response.json();
      const requested=new URLSearchParams(location.search).get('theme')==='org-note3';
      if(mounted&&(requested||pack.previewDefault===true))setPreviewTheme({...parseThemePack(pack),id:'org-note3',name:'org-note3'});
    }).catch(()=>{});
    const stopPreview=()=>{mounted=false;setPreviewTheme(null);};
    window.addEventListener('phoenix-theme-selected',stopPreview);
    return()=>{mounted=false;window.removeEventListener('phoenix-theme-selected',stopPreview);};
  },[]);
  const [loading, setLoading] = useState(true);

  const profileRevision=useRef(0);
  const saveQueue=useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    const revision=profileRevision.current;
    try {
      const res = await localRequest("/api/profile", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as { profile: AppProfile };
      const p = data.profile;
      const legacyBg = !p.boardBg || p.boardBg === BRANDING.COLORS.CHALKBOARD_GREEN || p.boardBg === '#83d131';
      if(revision===profileRevision.current)setProfile({
        ...DEFAULT_PROFILE,
        ...p,
        ...(legacyBg ? { boardBg: '#18212b', boardPattern: p.boardPattern === 'none' ? 'dots' : (p.boardPattern || 'dots'), defaultPenColor: p.defaultPenColor === '#ffffff' ? '#f4f4f5' : (p.defaultPenColor || '#f4f4f5') } : {}),
        createdAt: new Date(data.profile.createdAt),
        updatedAt: new Date(data.profile.updatedAt),
      });
    } catch (error) {
      import.meta.env.DEV && console.error("Failed to load profile", error);
      // Keep defaults so the UI never crashes on a transient failure.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(()=>{if(!loading){ window.phoenixStartup?.ready(); }},[loading]);

  // The user-defined name is shown as the document title everywhere.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = profile.appName || BRANDING.APP_NAME;
    }
  }, [profile.appName]);
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = profile.iconData || './icon.svg';
  }, [profile.iconData]);

  // Reflect the accent colour as a live CSS variable so the whole UI re-tints.
  useEffect(() => {
    if (typeof document !== "undefined" && profile.accent) {
      document.documentElement.style.setProperty("--color-brand", profile.accent);
      document.documentElement.style.setProperty("--color-brand-dark", `color-mix(in srgb, ${profile.accent} 75%, black)`);
      document.documentElement.style.setProperty("--color-brand-darker", `color-mix(in srgb, ${profile.accent} 45%, black)`);
      document.documentElement.style.setProperty("--color-brand-light", `color-mix(in srgb, ${profile.accent} 65%, white)`);
      document.documentElement.style.setProperty("--color-brand-glow", profile.accent);
    }
  }, [profile.accent]);

  useEffect(() => {
    const t = profile.theme ?? BUILTIN_THEMES[0];
    const isLight = isLightTheme(t);
    const root = document.documentElement;

    root.dataset.themeAppearance = t.appearance ?? 'phoenix';
    root.dataset.themeMode = isLight ? 'light' : 'dark';
    root.style.colorScheme = isLight ? 'light' : 'dark';

    for (const [key, color] of Object.entries(t.colors)) {
      if (color) root.style.setProperty(`--theme-${key}`, color);
    }

    const base = t.colors.base ?? t.colors.surface;
    const panel = t.colors.panel;
    const surface = t.colors.surface;
    const line = t.colors.line;
    const ink = t.colors.ink;
    const muted = t.colors.muted;

    // Derived contrast-aware secondary tokens
    const line2 = isLight
      ? `color-mix(in srgb, ${line} 75%, black 12%)`
      : `color-mix(in srgb, ${line} 75%, white 15%)`;
    const elevated = isLight
      ? `color-mix(in srgb, ${panel} 90%, black 5%)`
      : `color-mix(in srgb, ${surface} 85%, white 10%)`;
    const base2 = isLight
      ? `color-mix(in srgb, ${base} 92%, black 6%)`
      : `color-mix(in srgb, ${base} 85%, white 8%)`;
    const faint = isLight
      ? `color-mix(in srgb, ${muted} 75%, white)`
      : `color-mix(in srgb, ${muted} 70%, black)`;

    const colorTokens: Record<string, string> = {
      base,
      'base-2': base2,
      panel,
      'panel-2': surface,
      elevated,
      line,
      'line-2': line2,
      ink,
      muted,
      faint,
    };

    for (const [key, color] of Object.entries(colorTokens)) {
      root.style.setProperty(`--color-${key}`, color);
    }

    // Background pattern texture (exam center uses subtle radial dots on warm cream)
    if (t.id === 'warm-ivory' || base === '#f3e9dc') {
      root.style.setProperty('--color-base-pattern', 'radial-gradient(#dec9b8 1px, transparent 1px)');
      root.style.setProperty('--color-base-pattern-size', '32px 32px');
    } else if (isLight) {
      root.style.setProperty('--color-base-pattern', `radial-gradient(color-mix(in srgb, ${line} 40%, transparent) 1px, transparent 1px)`);
      root.style.setProperty('--color-base-pattern-size', '32px 32px');
    } else {
      root.style.setProperty('--color-base-pattern', 'none');
      root.style.setProperty('--color-base-pattern-size', 'auto');
    }

    root.style.setProperty('--tool-popup-gap', `${interfaceSettings(profile.ui).popupGap}px`);
    window.dispatchEvent(new Event('phoenix-popup-layout'));
  }, [profile.theme, profile.ui]);

  const updateProfile = useCallback((patch: Partial<AppProfile>) => {
    const revision=++profileRevision.current;
    setProfile(previous=>({...previous,...patch}));
    // A slow earlier save must never replace a newer theme selection.
    const save=saveQueue.current.then(async()=>{
      try{
        const response=await localRequest('/api/profile',{
          method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({...patch,...('boardImage' in patch?{boardImage:patch.boardImage??''}:{})}),
        });
        if(!response.ok)throw new Error('The local profile could not be saved.');
        const data=await response.json() as {profile:AppProfile};
        const p = data.profile;
      const legacyBg = !p.boardBg || p.boardBg === BRANDING.COLORS.CHALKBOARD_GREEN || p.boardBg === '#83d131';
      if(revision===profileRevision.current)setProfile({...DEFAULT_PROFILE,...p,...(legacyBg ? { boardBg: '#18212b', boardPattern: p.boardPattern === 'none' ? 'dots' : (p.boardPattern || 'dots'), defaultPenColor: p.defaultPenColor === '#ffffff' ? '#f4f4f5' : (p.defaultPenColor || '#f4f4f5') } : {}),createdAt:new Date(p.createdAt),updatedAt:new Date(p.updatedAt)});
      }catch(error){
        if(revision===profileRevision.current)await reload();
        throw new Error(error instanceof Error?`Settings could not be saved: ${error.message}`:'Settings could not be saved. Check available local storage.');
      }
    });
    saveQueue.current=save.catch(()=>{});
    return save;
  },[reload]);

  return (
    <AppContext.Provider value={{ profile, loading, updateProfile, reload }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
