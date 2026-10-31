"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/app-context";
import { useToast } from "@/lib/toast";
import { Icon } from "./Icon";
import { BUILTIN_THEMES, type ThemePack, isLightTheme } from "@/lib/theme-pack";

interface ThemeModalProps {
  onClose: () => void;
  onThemeSelect?: (theme: ThemePack) => void;
}

interface ThemeMeta {
  tag: string;
  category: "cream" | "dark" | "light" | "stem";
  description: string;
  badgeColor?: string;
  isExamFavorite?: boolean;
}

const THEME_METAS: Record<string, ThemeMeta> = {
  "warm-ivory": {
    tag: "Exam Center Cream",
    category: "cream",
    description: "The signature warm ivory parchment from the Exam Center — engineered for zero eye fatigue during extended teaching sessions.",
    badgeColor: "#a9746e",
    isExamFavorite: true,
  },
  "phoenix-ember": {
    tag: "Default Dark",
    category: "dark",
    description: "Deep obsidian workspace with royal cobalt highlights. High contrast and razor sharp for interactive displays.",
    badgeColor: "#0062ff",
  },
  "phoenix-chalkboard": {
    tag: "Chalkboard Slate",
    category: "stem",
    description: "Authentic deep pine emerald chalkboard with mint chalk accents for classic classroom lecture comfort.",
    badgeColor: "#2a9d8f",
  },
  "oxford-navy": {
    tag: "Academic Navy",
    category: "dark",
    description: "Distinguished collegiate midnight navy with crisp ice-white typography and vibrant sapphire accents.",
    badgeColor: "#3b82f6",
  },
  "phoenix-obsidian": {
    tag: "AMOLED Midnight",
    category: "dark",
    description: "Ultra-deep space black paired with neon cyan glow. Maximum battery efficiency on OLED displays.",
    badgeColor: "#38bdf8",
  },
  "nordic-slate": {
    tag: "Scandinavian Studio",
    category: "dark",
    description: "Cool granite tones and balanced arctic blue accents. A calm, modern aesthetic for focused work.",
    badgeColor: "#88c0d0",
  },
  "phoenix-paper": {
    tag: "Editorial Light",
    category: "light",
    description: "Crisp daylight book paper with warm newsprint tones and sharp editorial crimson highlights.",
    badgeColor: "#d9383a",
  },
  "sage-harmony": {
    tag: "Herbal Green",
    category: "light",
    description: "Gentle natural sage and celadon wash. Soothing organic palette for peaceful study and reading.",
    badgeColor: "#2e7d4d",
  },
  "classic-note": {
    tag: "Classic Board",
    category: "stem",
    description: "Retro smartboard interface layout with traditional tactile classroom tools.",
    badgeColor: "#407db2",
  },
};

export function ThemeModal({ onClose, onThemeSelect }: ThemeModalProps) {
  const { profile, updateProfile } = useApp();
  const { push } = useToast();

  const currentTheme = profile.theme ?? BUILTIN_THEMES[0];
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [syncBoardBackground, setSyncBoardBackground] = useState<boolean>(false);
  const [savingThemeId, setSavingThemeId] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Combine built-in themes and any custom saved packs
  const allThemes: ThemePack[] = [
    ...(profile.themePacks ?? []),
    ...BUILTIN_THEMES,
  ].filter((pack, idx, list) => list.findIndex((p) => p.id === pack.id) === idx);

  // Filter themes
  const filteredThemes = allThemes.filter((theme) => {
    const meta = THEME_METAS[theme.id];
    const categoryMatch =
      activeCategory === "all" ||
      (activeCategory === "cream" && (meta?.category === "cream" || isLightTheme(theme))) ||
      (activeCategory === "dark" && !isLightTheme(theme)) ||
      (activeCategory === "light" && isLightTheme(theme)) ||
      (activeCategory === "stem" && (meta?.category === "stem" || theme.boards?.length > 1));

    const query = searchQuery.trim().toLowerCase();
    const searchMatch =
      !query ||
      theme.name.toLowerCase().includes(query) ||
      (meta?.tag && meta.tag.toLowerCase().includes(query)) ||
      (meta?.description && meta.description.toLowerCase().includes(query));

    return categoryMatch && searchMatch;
  });

  const handleApplyTheme = async (theme: ThemePack) => {
    setSavingThemeId(theme.id);
    try {
      window.dispatchEvent(new Event("phoenix-theme-selected"));
      
      const patch: Record<string, unknown> = {
        theme,
        accent: theme.colors.accent,
      };

      // If user opted to match default board background
      if (syncBoardBackground) {
        const primaryBoard = theme.boards[0];
        if (primaryBoard) {
          patch.boardBg = primaryBoard.background;
          patch.boardPattern = primaryBoard.pattern;
          patch.defaultPenColor = primaryBoard.ink;
        } else if (theme.colors.base) {
          patch.boardBg = theme.colors.base;
          patch.defaultPenColor = theme.colors.ink;
        }
      }

      await updateProfile(patch);
      if (onThemeSelect) onThemeSelect(theme);
      push(`Applied "${theme.name}" theme across Phoenix Smartboard`, "info");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update theme", "error");
    } finally {
      setSavingThemeId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Theme & Background"
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 select-none animate-fadeIn"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="kn-modal-card flex flex-col w-full max-w-4xl max-h-[92vh] rounded-3xl border border-line bg-panel text-ink shadow-2xl overflow-hidden"
        style={{
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="flex items-center justify-between px-6 py-5 border-b border-line bg-panel-2/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-brand/15 text-brand border border-brand/25 shadow-sm">
              <Icon name="palette" className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-ink">Project Theme & Background</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-brand/10 text-brand border border-brand/20">
                  Full Project
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Select a visual atmosphere for your whiteboard, workspace, menus, and controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl border border-line/60 text-muted hover:text-ink hover:bg-elevated transition-colors"
            title="Close theme selector"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </header>

        {/* Toolbar: Category Filters, Search, and Sync toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-line bg-panel shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" role="tablist">
            {[
              { id: "all", label: "All Themes" },
              { id: "cream", label: "Cream & Warm" },
              { id: "dark", label: "Dark & Slate" },
              { id: "light", label: "Daylight" },
              { id: "stem", label: "Classroom" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-brand text-white shadow-sm"
                    : "bg-panel-2 text-muted hover:text-ink hover:bg-elevated"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search & Board sync checkbox */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search themes..."
                className="w-full text-xs py-1.5 pl-8 pr-3 rounded-xl border border-line bg-base text-ink placeholder:text-muted/60 focus:outline-none focus:border-brand"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none">
                <Icon name="select" className="w-3.5 h-3.5 rotate-45" />
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncBoardBackground}
                onChange={(e) => setSyncBoardBackground(e.target.checked)}
                className="w-4 h-4 rounded border-line accent-brand"
              />
              <span className="hidden md:inline">Set whiteboard background to match</span>
              <span className="md:hidden">Sync board</span>
            </label>
          </div>
        </div>

        {/* Theme Cards Grid */}
        <div className="flex-1 overflow-y-auto kn-scroll p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredThemes.map((pack) => {
              const isActive = currentTheme.id === pack.id;
              const meta = THEME_METAS[pack.id];
              const isLight = isLightTheme(pack);
              const baseColor = pack.colors.base ?? pack.colors.surface;
              const hasRadialPattern = pack.id === "warm-ivory" || baseColor === "#f3e9dc";

              return (
                <div
                  key={pack.id}
                  onClick={() => void handleApplyTheme(pack)}
                  className={`group relative flex flex-col justify-between rounded-2xl border transition-all cursor-pointer overflow-hidden p-4 ${
                    isActive
                      ? "ring-2 ring-brand border-brand shadow-lg scale-[1.01]"
                      : "border-line hover:border-line-2 hover:shadow-md bg-panel-2/50 hover:bg-panel-2"
                  }`}
                  style={{
                    backgroundColor: isActive ? "var(--color-elevated)" : undefined,
                  }}
                >
                  {/* Active or Favorite Indicator Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs"
                      style={{
                        backgroundColor: `${meta?.badgeColor ?? pack.colors.accent}18`,
                        color: meta?.badgeColor ?? pack.colors.accent,
                        borderColor: `${meta?.badgeColor ?? pack.colors.accent}40`,
                      }}
                    >
                      {meta?.tag ?? (isLight ? "Light Theme" : "Dark Theme")}
                    </span>

                    {isActive ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand text-white shadow-sm">
                        <Icon name="check" className="w-3 h-3" />
                        Active
                      </span>
                    ) : meta?.isExamFavorite ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ebdcc9] text-[#78544c] border border-[#ddcbba]">
                        Exam Center
                      </span>
                    ) : null}
                  </div>

                  {/* Live Realistic Mini Mockup Preview */}
                  <div
                    className="relative w-full h-24 rounded-xl border border-line/80 overflow-hidden mb-3.5 shadow-inner flex flex-col justify-between p-2.5 transition-transform group-hover:scale-[1.02]"
                    style={{
                      backgroundColor: baseColor,
                      colorScheme: isLight ? "light" : "dark",
                      backgroundImage: hasRadialPattern
                        ? "radial-gradient(#dec9b8 1.2px, transparent 1.2px)"
                        : isLight
                        ? `radial-gradient(${pack.colors.line}40 1px, transparent 1px)`
                        : undefined,
                      backgroundSize: "20px 20px",
                    }}
                  >
                    {/* Simulated Card Header */}
                    <div
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border shadow-xs"
                      style={{
                        backgroundColor: pack.colors.panel,
                        borderColor: pack.colors.line,
                        color: pack.colors.ink,
                      }}
                    >
                      <span className="text-[11px] font-bold truncate max-w-[130px]">{pack.name}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: pack.colors.accent }}
                      />
                    </div>

                    {/* Simulated Content & Buttons */}
                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: pack.colors.muted }}
                        >
                          Smartboard UI
                        </span>
                      </div>
                      <div
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: pack.colors.accent }}
                      >
                        Sample
                      </div>
                    </div>
                  </div>

                  {/* Theme Info & Palette Dots */}
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-sm text-ink group-hover:text-brand transition-colors">
                        {pack.name}
                      </h3>
                      {isLight ? (
                        <span className="text-[10px] font-medium text-muted">Warm / Light</span>
                      ) : (
                        <span className="text-[10px] font-medium text-muted">Deep Dark</span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                      {meta?.description ?? "Classroom-tested color palette for modern smartboard teaching."}
                    </p>

                    {/* 4 Palette Swatch Circles */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line/60">
                      <span className="text-[10px] text-muted font-medium">Palette:</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          title={`Background: ${baseColor}`}
                          className="w-4 h-4 rounded-full border border-line/60 shadow-xs"
                          style={{ backgroundColor: baseColor }}
                        />
                        <span
                          title={`Panel Card: ${pack.colors.panel}`}
                          className="w-4 h-4 rounded-full border border-line/60 shadow-xs"
                          style={{ backgroundColor: pack.colors.panel }}
                        />
                        <span
                          title={`Text Ink: ${pack.colors.ink}`}
                          className="w-4 h-4 rounded-full border border-line/60 shadow-xs"
                          style={{ backgroundColor: pack.colors.ink }}
                        />
                        <span
                          title={`Accent: ${pack.colors.accent}`}
                          className="w-4 h-4 rounded-full border border-line/60 shadow-xs"
                          style={{ backgroundColor: pack.colors.accent }}
                        />
                      </div>

                      <button
                        type="button"
                        disabled={savingThemeId === pack.id}
                        className={`ml-auto text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${
                          isActive
                            ? "bg-brand/15 text-brand"
                            : "bg-panel text-ink group-hover:bg-brand group-hover:text-white"
                        }`}
                      >
                        {isActive ? "Active" : savingThemeId === pack.id ? "Applying..." : "Select"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredThemes.length === 0 && (
            <div className="p-12 text-center rounded-2xl border border-dashed border-line text-muted">
              <p className="font-semibold text-ink">No themes found matching "{searchQuery}"</p>
              <p className="text-xs mt-1">Try another search or select "All Themes" above.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="flex items-center justify-between px-6 py-4 border-t border-line bg-panel-2/50 shrink-0">
          <p className="text-xs text-muted">
            Themes are saved automatically on this device and persist across all lessons and pages.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-panel text-ink border border-line hover:bg-elevated font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
