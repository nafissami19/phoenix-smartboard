import React, { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import { useDialog } from "@/lib/use-dialog";
import { Icon } from "../Icon";
import { useApp } from "@/lib/app-context";
import { BUILTIN_THEMES, isLightTheme, type ThemePack } from "@/lib/theme-pack";
import { ThemeModal } from "../ThemeModal";
import {
  ExamPreset,
  ExamSection,
  loadExamPresets,
  saveExamPresets,
  loadActiveExamPresetId,
  saveActiveExamPresetId,
  NSU_EXAM_TIMER_PRESET,
  calculateTotalExamDurationMinutes,
  formatDurationLabel,
  formatTimeRemaining,
  playSectionChangeChime,
  playExamFinishedChime,
} from "../../lib/exam-timers";

interface ExamTimerModalProps {
  onClose: () => void;
}

function getContrastTextColor(hexColor: string): string {
  const hex = (hexColor || "#e63946").replace(/^#/, "");
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#0f172a" : "#ffffff";
}

export function ExamTimerModal({ onClose }: ExamTimerModalProps) {
  const { profile } = useApp();
  const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false);

  const activeTheme: ThemePack = useMemo(() => {
    return profile.theme ?? BUILTIN_THEMES[0];
  }, [profile.theme]);

  const isLight = isLightTheme(activeTheme);
  const themeColors = activeTheme.colors;
  const accentTextColor = useMemo(() => getContrastTextColor(themeColors.accent), [themeColors.accent]);

  const modalBg = themeColors.base ?? (isLight ? "#fbf5ed" : "#0d1117");

  const backgroundPattern = useMemo(() => {
    if (activeTheme.id === "warm-ivory" || themeColors.base === "#f3e9dc") {
      return "radial-gradient(#dec9b8 1.2px, transparent 1.2px)";
    }
    if (isLight) {
      return `radial-gradient(${themeColors.line}60 1px, transparent 1px)`;
    }
    return "radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)";
  }, [activeTheme.id, themeColors.base, themeColors.line, isLight]);

  const [presets, setPresets] = useState<ExamPreset[]>(() => loadExamPresets());
  const [activePresetId, setActivePresetId] = useState<string>(() => loadActiveExamPresetId());

  // Start in Selection Hub view so user chooses NSU or custom timer
  const [isChoosingPreset, setIsChoosingPreset] = useState<boolean>(true);

  const activePreset = useMemo(() => {
    return presets.find((p) => p.id === activePresetId) || presets[0] || NSU_EXAM_TIMER_PRESET;
  }, [presets, activePresetId]);

  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const firstSec = activePreset.sections[0];
    return firstSec ? firstSec.durationMinutes * 60 : 25 * 60;
  });
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasExamFinished, setHasExamFinished] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");

  // Manual Adjust Minutes & Seconds State
  const [manualAdjMins, setManualAdjMins] = useState<string>("1");
  const [manualAdjSecs, setManualAdjSecs] = useState<string>("0");

  // Add / Edit Preset Modal State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isEditingNew, setIsEditingNew] = useState<boolean>(false);
  const [editingPreset, setEditingPreset] = useState<ExamPreset | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Escape is handled by the layered handler below (theme modal > editor > timer).
  useDialog<HTMLDivElement>({ ref: containerRef, escape: false });
  const deadlineRef = useRef<number | null>(null);

  // Live wall-clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // A nested dialog (e.g. ThemeModal) that already handled Escape marks it defaultPrevented.
      if (e.key === "Escape" && !e.defaultPrevented) {
        if (themeModalOpen) {
          setThemeModalOpen(false);
        } else if (isEditorOpen) {
          setIsEditorOpen(false);
          setEditingPreset(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [themeModalOpen, isEditorOpen, onClose]);

  // Sync remainingSeconds when activePreset changes and not running
  const resetExam = useCallback(
    (preset: ExamPreset = activePreset) => {
      setIsRunning(false);
      setCurrentSectionIndex(0);
      setHasExamFinished(false);
      deadlineRef.current = null;
      const firstSec = preset.sections[0];
      setRemainingSeconds(firstSec ? firstSec.durationMinutes * 60 : 0);
    },
    [activePreset]
  );

  const handleLaunchPreset = (presetId: string) => {
    setActivePresetId(presetId);
    saveActiveExamPresetId(presetId);
    const target = presets.find((p) => p.id === presetId);
    if (target) {
      resetExam(target);
    }
    setIsChoosingPreset(false);
  };

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Synchronize deadline reference when running state changes
  useEffect(() => {
    if (isRunning && !hasExamFinished) {
      deadlineRef.current = Date.now() + remainingSeconds * 1000;
    } else {
      deadlineRef.current = null;
    }
  }, [isRunning, hasExamFinished]);

  // Wall-clock anchored timer tick engine to eliminate background drift
  useEffect(() => {
    if (!isRunning || hasExamFinished) return;

    const interval = setInterval(() => {
      if (deadlineRef.current == null) return;
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);

      if (left <= 0) {
        const nextIndex = currentSectionIndex + 1;
        if (nextIndex < activePreset.sections.length) {
          if (!isMuted) playSectionChangeChime();
          setCurrentSectionIndex(nextIndex);
          const nextSecDuration = (activePreset.sections[nextIndex]?.durationMinutes || 1) * 60;
          setRemainingSeconds(nextSecDuration);
          deadlineRef.current = Date.now() + nextSecDuration * 1000;
        } else {
          if (!isMuted) playExamFinishedChime();
          setHasExamFinished(true);
          setIsRunning(false);
          deadlineRef.current = null;
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, hasExamFinished, currentSectionIndex, activePreset.sections, isMuted]);

  // Section quick manual controls
  const handleSkipNext = () => {
    if (currentSectionIndex < activePreset.sections.length - 1) {
      const nextIdx = currentSectionIndex + 1;
      const dur = (activePreset.sections[nextIdx]?.durationMinutes || 1) * 60;
      setCurrentSectionIndex(nextIdx);
      setRemainingSeconds(dur);
      if (isRunning) deadlineRef.current = Date.now() + dur * 1000;
      setHasExamFinished(false);
      if (!isMuted) playSectionChangeChime();
    } else {
      setHasExamFinished(true);
      setIsRunning(false);
      setRemainingSeconds(0);
      deadlineRef.current = null;
      if (!isMuted) playExamFinishedChime();
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      const prevIdx = currentSectionIndex - 1;
      const dur = (activePreset.sections[prevIdx]?.durationMinutes || 1) * 60;
      setCurrentSectionIndex(prevIdx);
      setRemainingSeconds(dur);
      if (isRunning) deadlineRef.current = Date.now() + dur * 1000;
      setHasExamFinished(false);
    }
  };

  const handleResetCurrentSection = () => {
    const sec = activePreset.sections[currentSectionIndex];
    if (sec) {
      const dur = sec.durationMinutes * 60;
      setRemainingSeconds(dur);
      if (isRunning) deadlineRef.current = Date.now() + dur * 1000;
      setHasExamFinished(false);
    }
  };

  const handleAdjustSeconds = (deltaSeconds: number) => {
    setRemainingSeconds((prev) => {
      const next = Math.max(0, prev + deltaSeconds);
      if (isRunning) deadlineRef.current = Date.now() + next * 1000;
      return next;
    });
  };

  const handleApplyManualAdjustment = (isAdd: boolean) => {
    const m = Math.max(0, parseInt(manualAdjMins, 10) || 0);
    const s = Math.max(0, parseInt(manualAdjSecs, 10) || 0);
    const totalDelta = m * 60 + s;
    if (totalDelta <= 0) return;
    handleAdjustSeconds(isAdd ? totalDelta : -totalDelta);
  };

  // Editor Actions
  const openNewPresetEditor = () => {
    const newPreset: ExamPreset = {
      id: "preset-" + Date.now(),
      title: "Custom Exam Timer",
      description: "Custom examination schedule",
      createdAt: Date.now(),
      sections: [
        { id: "sec-" + Math.random().toString(36).substring(2, 9), name: "Section A", durationMinutes: 30 },
        { id: "sec-" + Math.random().toString(36).substring(2, 9), name: "Section B", durationMinutes: 60 },
      ],
    };
    setIsEditingNew(true);
    setEditingPreset(newPreset);
    setIsEditorOpen(true);
  };

  const openEditPreset = (presetToEdit: ExamPreset) => {
    setIsEditingNew(false);
    setEditingPreset(JSON.parse(JSON.stringify(presetToEdit)));
    setIsEditorOpen(true);
  };

  const handleSaveEditedPreset = (saved: ExamPreset) => {
    const exists = presets.some((p) => p.id === saved.id);
    let updated: ExamPreset[];
    if (exists) {
      updated = presets.map((p) => (p.id === saved.id ? saved : p));
    } else {
      updated = [...presets, saved];
    }
    setPresets(updated);
    saveExamPresets(updated);
    setActivePresetId(saved.id);
    saveActiveExamPresetId(saved.id);
    resetExam(saved);
    setIsEditorOpen(false);
    setEditingPreset(null);
  };

  const handleDeletePreset = (id: string) => {
    if (presets.length <= 1) return;
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    saveExamPresets(updated);
    if (id === activePresetId) {
      const nextPreset = updated[0];
      setActivePresetId(nextPreset.id);
      saveActiveExamPresetId(nextPreset.id);
      resetExam(nextPreset);
    }
    setIsEditorOpen(false);
    setEditingPreset(null);
  };

  // Calculations for current section UI
  const currentSection = activePreset.sections[currentSectionIndex] || {
    name: "Section",
    durationMinutes: 1,
  };
  const currentSecTotalSeconds = Math.max(1, currentSection.durationMinutes * 60);
  const currentSecElapsedSeconds = Math.max(0, currentSecTotalSeconds - remainingSeconds);
  const currentSecProgressPercent = Math.min(
    100,
    Math.max(0, (currentSecElapsedSeconds / currentSecTotalSeconds) * 100)
  );

  const totalExamMinutes = calculateTotalExamDurationMinutes(activePreset);

  // Time warning states
  const isDangerTime = !hasExamFinished && remainingSeconds <= 60 && remainingSeconds > 0;
  const isWarningTime = !hasExamFinished && remainingSeconds <= 300 && remainingSeconds > 60;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-(--z-modal) flex flex-col select-none overflow-y-auto"
      style={{
        backgroundColor: modalBg,
        color: themeColors.ink,
        colorScheme: isLight ? "light" : "dark",
        backgroundImage: backgroundPattern,
        backgroundSize: "32px 32px",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          backgroundColor: isLight
            ? `color-mix(in srgb, ${themeColors.panel} 95%, transparent)`
            : `color-mix(in srgb, ${themeColors.panel} 90%, transparent)`,
          borderColor: themeColors.line,
        }}
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b backdrop-blur-md shrink-0"
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: themeColors.accent,
              color: accentTextColor,
            }}
            className="flex items-center justify-center w-11 h-11 rounded-2xl shadow-sm shrink-0"
          >
            <Icon name="timer" className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 id={titleId} style={{ color: themeColors.ink }} className="text-xl font-bold tracking-tight">
                {isChoosingPreset ? "Exam Timer" : activePreset.title}
              </h1>
              {!isChoosingPreset && (
                <span
                  style={{
                    backgroundColor: `${themeColors.accent}20`,
                    color: isLight ? themeColors.ink : themeColors.accent,
                    borderColor: `${themeColors.accent}40`,
                  }}
                  className="text-xs px-2.5 py-0.5 rounded-full font-semibold border"
                >
                  {formatDurationLabel(totalExamMinutes)} Total
                </span>
              )}
            </div>
            <p style={{ color: themeColors.muted }} className="text-xs">
              {isChoosingPreset
                ? "Select an exam timer or create a new one"
                : `${activePreset.sections.length} Sections · Sequential Exam Timer`}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {!isChoosingPreset ? (
            <button
              type="button"
              onClick={() => setIsChoosingPreset(true)}
              title="Return to timer selection menu"
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.line,
                color: themeColors.ink,
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-semibold shadow-xs hover:brightness-105 active:scale-[0.98] transition-all min-h-[44px]"
            >
              <Icon name="chevronLeft" className="w-4 h-4 shrink-0" />
              <span>Change Timer</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openNewPresetEditor}
              title="Add a new custom exam schedule"
              style={{
                backgroundColor: themeColors.accent,
                color: accentTextColor,
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold shadow-sm hover:brightness-110 active:scale-[0.98] transition-all min-h-[44px]"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>Add New Timer</span>
            </button>
          )}

          {!isChoosingPreset && (
            <button
              type="button"
              onClick={() => openEditPreset(activePreset)}
              title="Edit this exam schedule"
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.line,
                color: themeColors.ink,
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-sm font-semibold shadow-xs hover:brightness-105 active:scale-[0.98] transition-all min-h-[44px]"
            >
              <Icon name="edit" className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {/* Quick Theme Selector Pill */}
          <button
            type="button"
            onClick={() => setThemeModalOpen(true)}
            title={`Active Theme: ${activeTheme.name}. Click to switch theme.`}
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.line,
              color: themeColors.ink,
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold shadow-xs hover:brightness-105 active:scale-[0.98] transition-all min-h-[44px]"
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0 shadow-xs"
              style={{
                backgroundColor: themeColors.panel,
                boxShadow: `0 0 0 2px ${themeColors.accent}55`,
              }}
            />
            <span style={{ color: themeColors.muted }} className="hidden md:inline">Theme:</span>
            <span className="font-bold truncate max-w-[110px]">{activeTheme.name}</span>
          </button>

          {/* Live Wall Clock */}
          <div
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.line,
              color: themeColors.ink,
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border font-mono text-sm shadow-inner min-h-[44px]"
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: themeColors.accent }}
            />
            <span style={{ color: themeColors.muted }} className="text-xs hidden md:inline">Clock:</span>
            <span className="font-bold text-sm">{currentTimeStr}</span>
          </div>

          {/* Mute Chime Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            title={isMuted ? "Unmute sound alert" : "Mute sound alert"}
            aria-label={isMuted ? "Unmute sound alert" : "Mute sound alert"}
            style={{
              backgroundColor: isMuted ? (isLight ? "#fee2e2" : "rgba(239, 68, 68, 0.2)") : themeColors.surface,
              borderColor: isMuted ? (isLight ? "#fca5a5" : "rgba(239, 68, 68, 0.4)") : themeColors.line,
              color: isMuted ? "#ef4444" : themeColors.ink,
            }}
            className="p-2.5 rounded-2xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center hover:brightness-105 active:scale-[0.98] shadow-xs"
          >
            <Icon name={isMuted ? "bellOff" : "bell"} className="w-5 h-5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.line,
              color: themeColors.ink,
            }}
            className="p-2.5 rounded-2xl border hover:brightness-105 active:scale-[0.98] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center shadow-xs"
          >
            <Icon name={isFullscreen ? "shrink" : "expand"} className="w-5 h-5" />
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            title="Exit Exam Timer"
            aria-label="Exit Exam Timer"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.line,
              color: themeColors.ink,
            }}
            className="p-2.5 rounded-2xl border hover:bg-danger-subtle hover:text-danger hover:border-danger/30 active:scale-[0.98] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center shadow-xs"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* VIEW 1: PRESET SELECTION HUB */}
      {isChoosingPreset ? (
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-start gap-8">
          <div className="text-center">
            <h2 style={{ color: themeColors.ink }} className="text-3xl font-extrabold tracking-tight">
              Select Exam Timer
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Presets List */}
            {presets.map((preset) => {
              const totalMins = calculateTotalExamDurationMinutes(preset);
              const isNsu = preset.id === NSU_EXAM_TIMER_PRESET.id;

              return (
                <div
                  key={preset.id}
                  style={{
                    backgroundColor: themeColors.panel,
                    borderColor: themeColors.line,
                  }}
                  className="flex flex-col justify-between p-6 rounded-2xl border shadow-md hover:border-brand transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 style={{ color: themeColors.ink }} className="text-xl font-bold">{preset.title}</h3>
                      {isNsu && (
                        <span
                          style={{
                            backgroundColor: `${themeColors.accent}20`,
                            color: themeColors.accent,
                            borderColor: `${themeColors.accent}40`,
                          }}
                          className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                        >
                          Standard
                        </span>
                      )}
                    </div>
                    {preset.description && (
                      <p style={{ color: themeColors.muted }} className="text-xs mb-4 leading-relaxed">
                        {preset.description}
                      </p>
                    )}

                    <div className="space-y-2 mb-6">
                      {preset.sections.map((sec, idx) => (
                        <div
                          key={sec.id || idx}
                          style={{
                            backgroundColor: themeColors.surface,
                            borderColor: themeColors.line,
                            color: themeColors.muted,
                          }}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs"
                        >
                          <span style={{ color: themeColors.ink }} className="font-semibold">{sec.name}</span>
                          <span style={{ color: themeColors.ink }} className="font-mono font-bold">
                            {sec.durationMinutes}m
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div
                    style={{ borderColor: themeColors.line }}
                    className="flex items-center gap-2.5 pt-4 border-t"
                  >
                    <button
                      type="button"
                      onClick={() => handleLaunchPreset(preset.id)}
                      style={{
                        backgroundColor: themeColors.accent,
                        color: accentTextColor,
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold text-sm shadow-sm hover:brightness-110 active:scale-[0.98] transition-all min-h-[46px]"
                    >
                      <Icon name="play" className="w-4 h-4" filled />
                      <span>Start {preset.title}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditPreset(preset)}
                      title="Edit timer sections"
                      aria-label={`Edit ${preset.title} sections`}
                      style={{
                        backgroundColor: themeColors.surface,
                        borderColor: themeColors.line,
                        color: themeColors.ink,
                      }}
                      className="p-3 rounded-2xl border hover:brightness-105 active:scale-[0.98] transition-all min-h-[46px] min-w-[46px] flex items-center justify-center shadow-xs"
                    >
                      <Icon name="edit" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* "+ Add New Exam Timer" Card */}
            <button
              type="button"
              onClick={openNewPresetEditor}
              style={{
                backgroundColor: `${themeColors.panel}90`,
                borderColor: themeColors.line,
              }}
              className="kn-focus w-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed hover:border-brand hover:bg-panel cursor-pointer transition-all text-center min-h-[260px] group shadow-xs"
            >
              <div
                style={{
                  backgroundColor: themeColors.surface,
                  color: themeColors.ink,
                }}
                className="w-12 h-12 rounded-2xl group-hover:scale-110 flex items-center justify-center mb-3 transition-transform shadow-xs"
              >
                <Icon name="plus" className="w-6 h-6" />
              </div>
              <h3 style={{ color: themeColors.ink }} className="text-lg font-bold group-hover:text-brand transition-colors">
                Add New Exam Timer
              </h3>
              <p style={{ color: themeColors.muted }} className="text-xs mt-1 max-w-xs">
                Set up a custom examination with your own sections and durations.
              </p>
            </button>
          </div>
        </main>
      ) : (
        /* VIEW 2: ACTIVE EXAM STAGE */
        <main className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto px-6 py-6 sm:py-8 gap-6 sm:gap-8">
          {/* Section Sequence Horizontal Stepper */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-2.5">
              <span style={{ color: themeColors.muted }} className="text-xs font-bold uppercase tracking-[0.2em]">
                Exam Sections
              </span>
              <span style={{ color: themeColors.muted }} className="text-xs font-medium">
                Section {currentSectionIndex + 1} of {activePreset.sections.length}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activePreset.sections.map((section, idx) => {
                const isEnded = hasExamFinished || idx < currentSectionIndex;
                const isActive = !hasExamFinished && idx === currentSectionIndex;

                return (
                  <div
                    key={section.id || idx}
                    style={{
                      backgroundColor: isEnded
                        ? themeColors.surface
                        : isActive
                        ? themeColors.panel
                        : isLight
                        ? themeColors.surface
                        : themeColors.panel,
                      borderColor: isActive
                        ? themeColors.accent
                        : themeColors.line,
                      borderWidth: isActive ? "2px" : "1px",
                      boxShadow: isActive ? `0 4px 16px ${themeColors.accent}33` : "none",
                    }}
                    className="p-3.5 rounded-2xl border transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        style={{ color: isActive ? themeColors.ink : themeColors.muted }}
                        className="text-sm font-bold truncate pr-1"
                      >
                        {section.name}
                      </span>
                      <span
                        style={{
                          backgroundColor: isEnded
                            ? `${themeColors.line}`
                            : isActive
                            ? themeColors.accent
                            : `${themeColors.surface}`,
                          color: isActive
                            ? accentTextColor
                            : themeColors.muted,
                          borderColor: themeColors.line,
                        }}
                        className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 border"
                      >
                        {isEnded ? "Ended" : isActive ? "Active" : "Pending"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs" style={{ color: themeColors.muted }}>
                      <span className="font-medium">{section.durationMinutes}m</span>
                      {isActive && (
                        <span className="font-mono font-bold" style={{ color: themeColors.accent }}>
                          {formatTimeRemaining(remainingSeconds)}
                        </span>
                      )}
                    </div>

                    {/* Mini Progress Bar */}
                    <div
                      style={{ backgroundColor: `${themeColors.line}80` }}
                      className="w-full h-1.5 rounded-full mt-2.5 overflow-hidden"
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          backgroundColor: isEnded ? `${themeColors.accent}70` : themeColors.accent,
                          width: isEnded
                            ? "100%"
                            : isActive
                            ? `${currentSecProgressPercent}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center Stage: Minimalist Pomodoro-Style Countdown */}
          <div className="flex-1 flex flex-col items-center justify-center my-4 sm:my-6 text-center">
            {/* Prominent Section Headline */}
            <div className="mb-2 sm:mb-4">
              <h2
                style={{
                  color: isLight
                    ? `color-mix(in srgb, ${themeColors.ink} 90%, black)`
                    : themeColors.ink,
                }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-[0.2em] select-none"
              >
                {hasExamFinished ? "All Exam Sections Completed" : currentSection.name}
              </h2>
            </div>

            {/* Massive Digital Countdown */}
            <div className="my-2">
              <div
                style={{
                  color: hasExamFinished
                    ? "#10b981"
                    : isDangerTime
                    ? "#ef4444"
                    : isWarningTime
                    ? "#f59e0b"
                    : themeColors.accent,
                  filter: `drop-shadow(0 2px 14px ${
                    hasExamFinished
                      ? "rgba(16,185,129,0.3)"
                      : isDangerTime
                      ? "rgba(239,68,68,0.4)"
                      : isWarningTime
                      ? "rgba(245,158,11,0.3)"
                      : `${themeColors.accent}33`
                  })`,
                }}
                className={`font-mono tabular-nums font-extrabold tracking-tight leading-none text-8xl sm:text-9xl md:text-[11rem] lg:text-[12.5rem] transition-colors ${
                  isDangerTime ? "motion-safe:animate-pulse" : ""
                }`}
              >
                {hasExamFinished ? "00:00" : formatTimeRemaining(remainingSeconds)}
              </div>
            </div>

            {/* Primary Action Buttons (Solid, High-Contrast across ALL Themes) */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
              {/* Previous Section */}
              <button
                type="button"
                onClick={handlePrevSection}
                disabled={currentSectionIndex === 0}
                title="Return to previous section"
                style={{
                  backgroundColor: isLight ? themeColors.panel : themeColors.surface,
                  borderColor: themeColors.line,
                  color: themeColors.ink,
                }}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl border shadow-sm hover:brightness-105 active:scale-[0.98] font-bold text-base transition-all min-h-[52px] min-w-[110px] justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="chevronLeft" className="w-5 h-5 shrink-0" />
                <span>Prev</span>
              </button>

              {/* Main Start / Pause Button */}
              <button
                type="button"
                onClick={() => {
                  if (hasExamFinished) {
                    resetExam();
                  } else {
                    setIsRunning((r) => !r);
                  }
                }}
                title={isRunning ? "Pause exam timer" : "Start exam timer"}
                style={{
                  backgroundColor: hasExamFinished
                    ? "#10b981"
                    : isRunning
                    ? "#f59e0b"
                    : themeColors.accent,
                  color: hasExamFinished
                    ? "#ffffff"
                    : isRunning
                    ? "#ffffff"
                    : accentTextColor,
                }}
                className="flex items-center justify-center gap-2.5 px-10 py-3.5 rounded-2xl font-bold text-base sm:text-lg transition-all shadow-lg hover:brightness-110 active:scale-[0.98] min-h-[52px] min-w-[170px]"
              >
                <Icon
                  name={hasExamFinished ? "reset" : isRunning ? "pause" : "play"}
                  className="w-5 h-5 shrink-0"
                  filled
                />
                <span>
                  {hasExamFinished
                    ? "Restart"
                    : isRunning
                    ? "Pause"
                    : "Start"}
                </span>
              </button>

              {/* Reset Current Section */}
              <button
                type="button"
                onClick={handleResetCurrentSection}
                title="Reset current section to starting duration"
                style={{
                  backgroundColor: isLight ? themeColors.panel : themeColors.surface,
                  borderColor: themeColors.line,
                  color: themeColors.ink,
                }}
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl border shadow-sm hover:brightness-105 active:scale-[0.98] font-bold text-base transition-all min-h-[52px] min-w-[120px]"
              >
                <Icon name="reset" className="w-4 h-4 shrink-0" />
                <span>Reset</span>
              </button>

              {/* Skip to Next Section */}
              <button
                type="button"
                onClick={handleSkipNext}
                disabled={hasExamFinished}
                title="Finish current section and advance to next"
                style={{
                  backgroundColor: isLight ? themeColors.panel : themeColors.surface,
                  borderColor: themeColors.line,
                  color: themeColors.ink,
                }}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl border shadow-sm hover:brightness-105 active:scale-[0.98] font-bold text-base transition-all min-h-[52px] min-w-[110px] justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <Icon name="chevronRight" className="w-5 h-5 shrink-0" />
              </button>
            </div>
          </div>

          {/* Secondary Quick Adjustments Row */}
          <div
            style={{
              backgroundColor: isLight ? themeColors.panel : themeColors.surface,
              borderColor: themeColors.line,
            }}
            className="w-full max-w-2xl mx-auto px-5 py-3 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            {/* Quick Adjustments */}
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ color: themeColors.muted }} className="font-bold mr-1 uppercase tracking-wider text-[11px]">
                Adjust:
              </span>
              <div
                style={{
                  backgroundColor: themeColors.base ?? (isLight ? "#fbf5ed" : "#11141a"),
                  borderColor: themeColors.line,
                }}
                className="flex items-center gap-1.5 border rounded-xl px-2.5 py-1"
              >
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={manualAdjMins}
                  onChange={(e) => setManualAdjMins(e.target.value)}
                  aria-label="Adjust Minutes"
                  style={{
                    backgroundColor: "transparent",
                    color: themeColors.ink,
                    colorScheme: isLight ? "light" : "dark",
                  }}
                  className="w-8 !bg-transparent font-mono text-center text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span style={{ color: themeColors.muted }} className="text-[10px] font-semibold">m</span>
                <span style={{ color: themeColors.line }} className="text-xs">|</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={manualAdjSecs}
                  onChange={(e) => setManualAdjSecs(e.target.value)}
                  aria-label="Adjust Seconds"
                  style={{
                    backgroundColor: "transparent",
                    color: themeColors.ink,
                    colorScheme: isLight ? "light" : "dark",
                  }}
                  className="w-8 !bg-transparent font-mono text-center text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span style={{ color: themeColors.muted }} className="text-[10px] font-semibold">s</span>
              </div>

              <button
                type="button"
                onClick={() => handleApplyManualAdjustment(true)}
                disabled={hasExamFinished}
                title="Add entered time"
                style={{
                  backgroundColor: themeColors.accent,
                  color: accentTextColor,
                }}
                className="px-3 py-1.5 rounded-xl font-bold shadow-xs hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                + Add
              </button>
              <button
                type="button"
                onClick={() => handleApplyManualAdjustment(false)}
                disabled={hasExamFinished || remainingSeconds <= 1}
                title="Subtract entered time"
                style={{
                  backgroundColor: isLight ? themeColors.surface : themeColors.panel,
                  borderColor: themeColors.line,
                  color: themeColors.ink,
                }}
                className="px-3 py-1.5 rounded-xl font-bold border hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                - Deduct
              </button>

              <div className="flex items-center gap-1.5 ml-1">
                {[
                  { label: "+30s", delta: 30 },
                  { label: "+1m", delta: 60 },
                  { label: "+5m", delta: 300 },
                ].map((adj) => (
                  <button
                    key={adj.label}
                    type="button"
                    onClick={() => handleAdjustSeconds(adj.delta)}
                    disabled={hasExamFinished}
                    style={{
                      backgroundColor: isLight ? themeColors.surface : themeColors.panel,
                      borderColor: themeColors.line,
                      color: themeColors.ink,
                    }}
                    className="px-2.5 py-1.5 rounded-xl border font-mono text-xs font-bold hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    {adj.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Exam */}
            <button
              type="button"
              onClick={() => resetExam()}
              title="Reset entire exam from Section A"
              style={{
                backgroundColor: isLight ? "#fee2e2" : "rgba(239, 68, 68, 0.15)",
                borderColor: isLight ? "#fca5a5" : "rgba(239, 68, 68, 0.35)",
                color: isLight ? "#b91c1c" : "#fca5a5",
              }}
              className="px-3.5 py-1.5 rounded-xl border font-bold text-xs hover:brightness-105 active:scale-[0.98] transition-all shadow-xs"
            >
              Reset All
            </button>
          </div>
        </main>
      )}

      {/* Add / Edit Preset Drawer Modal */}
      {isEditorOpen && editingPreset && (
        <PresetEditorModal
          preset={editingPreset}
          isNew={isEditingNew}
          themeColors={themeColors}
          isLight={isLight}
          accentTextColor={accentTextColor}
          onSave={handleSaveEditedPreset}
          onDelete={handleDeletePreset}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingPreset(null);
          }}
        />
      )}

      {/* Theme Selector Modal */}
      {themeModalOpen && (
        <ThemeModal onClose={() => setThemeModalOpen(false)} />
      )}
    </div>
  );
}

// Preset Editor Modal Component
function PresetEditorModal({
  preset,
  isNew,
  themeColors,
  isLight,
  accentTextColor,
  onSave,
  onDelete,
  onClose,
}: {
  preset: ExamPreset;
  isNew: boolean;
  themeColors: ThemePack["colors"];
  isLight: boolean;
  accentTextColor: string;
  onSave: (preset: ExamPreset) => void;
  onDelete: (presetId: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(preset.title);
  const [description, setDescription] = useState(preset.description || "");
  const [sections, setSections] = useState<Array<Omit<ExamSection, "durationMinutes"> & { durationMinutes: number | string }>>(() =>
    preset.sections.map((s) => ({ ...s }))
  );

  const handleAddSection = () => {
    const nextLetter = String.fromCharCode(65 + sections.length);
    setSections([
      ...sections,
      {
        id: "sec-" + Math.random().toString(36).substring(2, 9),
        name: `Section ${nextLetter}`,
        durationMinutes: 30,
      },
    ]);
  };

  const handleRemoveSection = (index: number) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleUpdateSection = (
    index: number,
    field: "name" | "durationMinutes",
    value: string
  ) => {
    setSections(
      sections.map((s, i) => {
        if (i !== index) return s;
        if (field === "durationMinutes") {
          return { ...s, durationMinutes: value };
        }
        return { ...s, [field]: value };
      })
    );
  };

  const handleBlurDuration = (index: number) => {
    setSections(
      sections.map((s, i) => {
        if (i !== index) return s;
        const val = Math.max(1, Math.min(360, parseInt(String(s.durationMinutes), 10) || 1));
        return { ...s, durationMinutes: val };
      })
    );
  };

  const editorRef = useDialog<HTMLDivElement>({ escape: false });
  const formId = useId();
  const totalMins = sections.reduce((acc, s) => acc + (parseInt(String(s.durationMinutes), 10) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || sections.length === 0) return;
    const sanitizedSections: ExamSection[] = sections.map((s) => ({
      id: s.id,
      name: s.name.trim() || "Section",
      durationMinutes: Math.max(1, Math.min(360, parseInt(String(s.durationMinutes), 10) || 1)),
    }));
    onSave({
      ...preset,
      title: title.trim(),
      description: description.trim(),
      sections: sanitizedSections,
    });
  };

  return (
    <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        ref={editorRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-heading`}
        style={{
          backgroundColor: themeColors.panel,
          borderColor: themeColors.line,
          color: themeColors.ink,
        }}
        className="w-full max-w-xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.line,
          }}
          className="flex items-center justify-between px-6 py-4 border-b"
        >
          <div>
            <h3 id={`${formId}-heading`} style={{ color: themeColors.ink }} className="text-lg font-bold">
              {isNew ? "Create Exam Timer" : "Edit Exam Schedule"}
            </h3>
            <p style={{ color: themeColors.muted }} className="text-xs">
              Set section names and minute durations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close exam timer editor"
            title="Close"
            style={{ color: themeColors.muted }}
            className="grid min-h-11 min-w-11 place-items-center p-2 rounded-xl hover:text-ink hover:bg-elevated transition-colors"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label htmlFor={`${formId}-title`} style={{ color: themeColors.muted }} className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
              Exam Title
            </label>
            <input
              id={`${formId}-title`}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. NSU Final Examination"
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.line,
                color: themeColors.ink,
                colorScheme: isLight ? "light" : "dark",
              }}
              className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:border-brand text-sm font-semibold"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor={`${formId}-description`} style={{ color: themeColors.muted }} className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <input
              id={`${formId}-description`}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 4-section exam with automated transitions"
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.line,
                color: themeColors.ink,
                colorScheme: isLight ? "light" : "dark",
              }}
              className="w-full px-4 py-2 rounded-xl border focus:outline-none focus:border-brand text-xs"
            />
          </div>

          {/* Sections List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 id={`${formId}-sections`} style={{ color: themeColors.muted }} className="text-xs font-semibold uppercase tracking-wider">
                Sections & Durations ({sections.length})
              </h4>
              <span style={{ color: themeColors.accent }} className="text-xs font-mono font-bold">
                Total: {totalMins}m ({formatDurationLabel(totalMins)})
              </span>
            </div>

            <div className="space-y-2.5" role="group" aria-labelledby={`${formId}-sections`}>
              {sections.map((section, idx) => (
                <div
                  key={section.id || idx}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.line,
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl border"
                >
                  <span style={{ color: themeColors.muted }} className="text-xs font-bold w-6 text-center">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    aria-label={`Section ${idx + 1} name`}
                    value={section.name}
                    onChange={(e) => handleUpdateSection(idx, "name", e.target.value)}
                    placeholder="Section Name"
                    style={{
                      backgroundColor: themeColors.panel,
                      borderColor: themeColors.line,
                      color: themeColors.ink,
                      colorScheme: isLight ? "light" : "dark",
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border text-sm font-medium focus:outline-none focus:border-brand"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      required
                      min={1}
                      max={360}
                      aria-label={`Section ${idx + 1} duration in minutes`}
                      value={section.durationMinutes}
                      onChange={(e) =>
                        handleUpdateSection(idx, "durationMinutes", e.target.value)
                      }
                      onBlur={() => handleBlurDuration(idx)}
                      style={{
                        backgroundColor: themeColors.panel,
                        borderColor: themeColors.line,
                        color: themeColors.ink,
                        colorScheme: isLight ? "light" : "dark",
                      }}
                      className="w-20 px-3 py-1.5 rounded-lg border text-sm font-mono text-center focus:outline-none focus:border-brand font-bold"
                    />
                    <span style={{ color: themeColors.muted }} className="text-xs font-semibold">min</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(idx)}
                    disabled={sections.length <= 1}
                    title="Delete this section"
                    aria-label={`Delete section ${idx + 1}`}
                    className="grid min-h-11 min-w-11 place-items-center p-2 rounded-lg text-danger hover:bg-danger-subtle disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddSection}
              style={{
                borderColor: themeColors.line,
                color: themeColors.accent,
                backgroundColor: `${themeColors.accent}12`,
              }}
              className="mt-3 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed font-semibold text-xs hover:brightness-110 transition-all w-full justify-center"
            >
              <Icon name="plus" className="w-4 h-4" />
              Add Another Section
            </button>
          </div>

          {/* Footer Controls */}
          <div
            style={{ borderColor: themeColors.line }}
            className="flex items-center justify-between pt-4 border-t"
          >
            {!preset.isBuiltin && (
              <button
                type="button"
                onClick={() => onDelete(preset.id)}
                className="px-3.5 py-2 rounded-xl bg-danger-subtle hover:brightness-95 text-danger border border-danger/30 text-xs font-bold transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.line,
                  color: themeColors.ink,
                }}
                className="px-4 py-2 rounded-xl border hover:brightness-105 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  backgroundColor: themeColors.accent,
                  color: accentTextColor,
                }}
                className="px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm hover:brightness-110 active:scale-[0.98]"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
