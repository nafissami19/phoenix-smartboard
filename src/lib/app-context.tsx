import {initializeDisplay} from './smartboard';
import {interfaceSettings,applyUiScale} from './interface-settings';
import {BUILTIN_THEMES,parseThemePack,isLightTheme,type ThemePack} from './theme-pack';
import { localRequest } from "@/lib/local-store";
import { DEFAULT_PROFILE, normalizeProfile } from "./profile-defaults";
import { mixHex, onColor, readableOn } from "./color-contrast";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { AppProfile } from "@/db/schema";
import { BRANDING } from '@/config/branding';
declare global {interface Window {phoenixStartup?:{ready:()=>void;retry:()=>void};}}

type AppContextValue = {
  profile: AppProfile;
  loading: boolean;
  /** Set when the stored profile could not be read; `profile` then holds defaults that must not be saved over it. */
  loadError: string | null;
  updateProfile: (patch: Partial<AppProfile>) => Promise<void>;
  reload: () => Promise<void>;
  retryLoad: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(()=>{void initializeDisplay().catch(()=>{});},[]);
  const [storedProfile, setProfile] = useState<AppProfile>(DEFAULT_PROFILE);
  const [previewTheme,setPreviewTheme]=useState<ThemePack|null>(()=>import.meta.env.DEV&&new URLSearchParams(location.search).get('theme')==='org-note3'?BUILTIN_THEMES.find(theme=>theme.id==='org-note3')!:null);
  const profile=useMemo(()=>previewTheme?{...storedProfile,theme:previewTheme,accent:previewTheme.colors.accent}:storedProfile,[storedProfile,previewTheme]);
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedOnce=useRef(false);

  const profileRevision=useRef(0);
  const saveQueue=useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    const revision=profileRevision.current;
    try {
      const res = await localRequest("/api/profile", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as { profile: AppProfile };
      if(revision===profileRevision.current)setProfile(normalizeProfile(data.profile));
      loadedOnce.current=true;setLoadError(null);
    } catch (error) {
      import.meta.env.DEV && console.error("Failed to load profile", error);
      // Defaults keep the UI rendering, but until a load succeeds they are not the
      // teacher's profile: routing and saving wait for a successful retry.
      if(!loadedOnce.current)setLoadError(error instanceof Error&&error.message!=='bad status'?error.message:'Your saved settings could not be read.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);
  const retryLoad = useCallback(async () => {setLoading(true);await reload();}, [reload]);
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

  // Reflect the accent colour as live CSS variables so the whole UI re-tints.
  // Text and on-brand colours are checked against WCAG AA (4.5:1) in JS.
  useEffect(() => {
    if (typeof document !== "undefined" && profile.accent) {
      const accent = profile.accent, t = profile.theme ?? BUILTIN_THEMES[0], mode = isLightTheme(t) ? 'light' : 'dark';
      const solid = mixHex(accent, '#000000', .92);
      const tokens: Record<string, string> = {
        brand: accent,
        'brand-solid': solid,
        'brand-hover': mixHex(accent, '#000000', .84),
        'brand-active': mixHex(accent, '#000000', .76),
        'brand-text': readableOn(accent, t.colors.panel, mode),
        'brand-subtle': `color-mix(in srgb, ${accent} 14%, transparent)`,
        'brand-ring': `color-mix(in srgb, ${accent} 55%, transparent)`,
        'on-brand': onColor(solid),
        // Legacy aliases.
        'brand-dark': `color-mix(in srgb, ${accent} 75%, black)`,
        'brand-darker': `color-mix(in srgb, ${accent} 45%, black)`,
        'brand-light': `color-mix(in srgb, ${accent} 65%, white)`,
        'brand-glow': accent,
      };
      for (const [key, value] of Object.entries(tokens)) document.documentElement.style.setProperty(`--color-${key}`, value);
    }
  }, [profile.accent, profile.theme]);

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
    const overlay = isLight
      ? `color-mix(in srgb, ${panel} 94%, white)`
      : `color-mix(in srgb, ${surface} 80%, white 14%)`;
    const lineStrong = `color-mix(in srgb, ${ink} 28%, transparent)`;
    const faint = isLight
      ? `color-mix(in srgb, ${muted} 75%, white)`
      : `color-mix(in srgb, ${muted} 70%, black)`;

    const colorTokens: Record<string, string> = {
      base,
      'base-2': base2,
      panel,
      'panel-2': surface,
      elevated,
      overlay,
      line,
      'line-2': line2,
      'line-strong': lineStrong,
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

    const ui=interfaceSettings(profile.ui);
    root.style.setProperty('--tool-popup-gap', `${ui.popupGap}px`);
    applyUiScale(ui.uiScale);
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
        if(revision===profileRevision.current)setProfile(normalizeProfile(data.profile));
      }catch(error){
        if(revision===profileRevision.current)await reload();
        throw new Error(error instanceof Error?`Settings could not be saved: ${error.message}`:'Settings could not be saved. Check available local storage.');
      }
    });
    saveQueue.current=save.catch(()=>{});
    return save;
  },[reload]);

  const value = useMemo(() => ({ profile, loading, loadError, updateProfile, reload, retryLoad }), [profile, loading, loadError, updateProfile, reload, retryLoad]);
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
