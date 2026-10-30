"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Icon } from "../Icon";
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

export function ExamTimerModal({ onClose }: ExamTimerModalProps) {
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
  const [editingPreset, setEditingPreset] = useState<ExamPreset | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Sync remainingSeconds when activePreset changes and not running
  const resetExam = useCallback(
    (preset: ExamPreset = activePreset) => {
      setIsRunning(false);
      setCurrentSectionIndex(0);
      setHasExamFinished(false);
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

  // Timer Tick Engine with Sequential Auto-Calling
  useEffect(() => {
    if (!isRunning || hasExamFinished) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        // Section time reached 0: Advance to next section!
        const nextIndex = currentSectionIndex + 1;
        if (nextIndex < activePreset.sections.length) {
          if (!isMuted) {
            playSectionChangeChime();
          }
          setCurrentSectionIndex(nextIndex);
          const nextSecDuration = activePreset.sections[nextIndex].durationMinutes * 60;
          return nextSecDuration;
        } else {
          // All sections ended!
          if (!isMuted) {
            playExamFinishedChime();
          }
          setHasExamFinished(true);
          setIsRunning(false);
          return 0;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, hasExamFinished, currentSectionIndex, activePreset.sections, isMuted]);

  // Section quick manual controls
  const handleSkipNext = () => {
    if (currentSectionIndex < activePreset.sections.length - 1) {
      const nextIdx = currentSectionIndex + 1;
      setCurrentSectionIndex(nextIdx);
      setRemainingSeconds(activePreset.sections[nextIdx].durationMinutes * 60);
      setHasExamFinished(false);
      if (!isMuted) playSectionChangeChime();
    } else {
      setHasExamFinished(true);
      setIsRunning(false);
      setRemainingSeconds(0);
      if (!isMuted) playExamFinishedChime();
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      const prevIdx = currentSectionIndex - 1;
      setCurrentSectionIndex(prevIdx);
      setRemainingSeconds(activePreset.sections[prevIdx].durationMinutes * 60);
      setHasExamFinished(false);
    }
  };

  const handleResetCurrentSection = () => {
    const sec = activePreset.sections[currentSectionIndex];
    if (sec) {
      setRemainingSeconds(sec.durationMinutes * 60);
      setHasExamFinished(false);
    }
  };

  const handleAdjustSeconds = (deltaSeconds: number) => {
    setRemainingSeconds((prev) => Math.max(0, prev + deltaSeconds));
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
        { id: "sec-1", name: "Section A", durationMinutes: 30 },
        { id: "sec-2", name: "Section B", durationMinutes: 60 },
      ],
    };
    setEditingPreset(newPreset);
    setIsEditorOpen(true);
  };

  const openEditPreset = (presetToEdit: ExamPreset) => {
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
    const nextPreset = updated[0];
    setActivePresetId(nextPreset.id);
    saveActiveExamPresetId(nextPreset.id);
    resetExam(nextPreset);
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

  // Overall Exam Time Remaining
  const totalExamMinutes = calculateTotalExamDurationMinutes(activePreset);
  const totalExamSeconds = totalExamMinutes * 60;
  const completedSectionsSeconds = activePreset.sections
    .slice(0, currentSectionIndex)
    .reduce((acc, s) => acc + s.durationMinutes * 60, 0);
  const totalElapsedSeconds =
    completedSectionsSeconds + (hasExamFinished ? currentSecTotalSeconds : currentSecElapsedSeconds);
  const totalRemainingSeconds = Math.max(0, totalExamSeconds - totalElapsedSeconds);
  const totalProgressPercent = Math.min(
    100,
    Math.max(0, (totalElapsedSeconds / totalExamSeconds) * 100)
  );

  // Time warning states
  const isDangerTime = !hasExamFinished && remainingSeconds <= 60 && remainingSeconds > 0;
  const isWarningTime = !hasExamFinished && remainingSeconds <= 300 && remainingSeconds > 60;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col text-slate-100 select-none overflow-y-auto"
      style={{
        backgroundColor: "#090d16",
        backgroundImage:
          "radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.12) 0%, transparent 60%), radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)",
        backgroundSize: "100% 100%, 32px 32px",
      }}
    >
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-[#0d121f]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white shadow-md">
            <Icon name="timer" className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {isChoosingPreset ? "Exam Timer" : activePreset.title}
              </h1>
              {!isChoosingPreset && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-white/10 text-slate-300">
                  {formatDurationLabel(totalExamMinutes)} Total
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isChoosingPreset
                ? "Select an exam timer or create a new one"
                : `${activePreset.sections.length} Sections · Sequential Exam Timer`}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {!isChoosingPreset ? (
            <button
              onClick={() => setIsChoosingPreset(true)}
              title="Return to timer selection menu"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold transition-colors min-h-[44px]"
            >
              <Icon name="chevronLeft" className="w-4 h-4 text-slate-400" />
              <span>Change Timer</span>
            </button>
          ) : (
            <button
              onClick={openNewPresetEditor}
              title="Add a new custom exam schedule"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>Add New Timer</span>
            </button>
          )}

          {!isChoosingPreset && (
            <button
              onClick={() => openEditPreset(activePreset)}
              title="Edit this exam schedule"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors min-h-[44px]"
            >
              <Icon name="edit" className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {/* Live Wall Clock */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-slate-300 font-mono text-sm shadow-inner min-h-[44px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400 text-xs hidden md:inline">Clock:</span>
            <span className="font-bold text-white text-sm">{currentTimeStr}</span>
          </div>

          {/* Mute Chime Toggle */}
          <button
            onClick={() => setIsMuted((m) => !m)}
            title={isMuted ? "Unmute sound alert" : "Mute sound alert"}
            className={`p-2.5 rounded-xl border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isMuted
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            <Icon name={isMuted ? "bellOff" : "bell"} className="w-5 h-5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Icon name={isFullscreen ? "shrink" : "expand"} className="w-5 h-5" />
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            title="Exit Exam Timer"
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-rose-600 hover:text-white text-slate-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* VIEW 1: PRESET SELECTION HUB (NSU & Add New ONLY) */}
      {isChoosingPreset ? (
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-start gap-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Select Exam Timer
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* NSU Exam Timer (and any custom ones created by the user) */}
            {presets.map((preset) => {
              const totalMins = calculateTotalExamDurationMinutes(preset);
              const isNsu = preset.id === NSU_EXAM_TIMER_PRESET.id;

              return (
                <div
                  key={preset.id}
                  className="flex flex-col justify-between p-6 rounded-2xl border border-white/10 bg-[#101624] shadow-xl hover:border-blue-500/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-xl font-bold text-white">{preset.title}</h3>
                      {isNsu && (
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Standard
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-400 mb-5">
                      {preset.sections.length} Sections · Total Duration: {formatDurationLabel(totalMins)}
                    </p>

                    {/* Section Breakdown List */}
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {preset.sections.map((sec, idx) => (
                        <div
                          key={sec.id || idx}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/30 border border-white/5 text-xs text-slate-300"
                        >
                          <span className="font-medium text-slate-300">{sec.name}</span>
                          <span className="font-mono font-bold text-white">
                            {sec.durationMinutes}m
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-4 border-t border-white/5">
                    <button
                      onClick={() => handleLaunchPreset(preset.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm min-h-[46px]"
                    >
                      <Icon name="play" className="w-4 h-4" />
                      <span>Start {preset.title}</span>
                    </button>

                    <button
                      onClick={() => openEditPreset(preset)}
                      title="Edit timer sections"
                      className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors min-h-[46px] min-w-[46px] flex items-center justify-center"
                    >
                      <Icon name="edit" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* "+ Add New Exam Timer" Card */}
            <div
              onClick={openNewPresetEditor}
              className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-white/15 hover:border-blue-400/60 bg-[#101624]/40 hover:bg-[#101624]/80 cursor-pointer transition-all text-center min-h-[260px] group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-blue-600/20 text-slate-400 group-hover:text-blue-400 flex items-center justify-center mb-3 transition-colors">
                <Icon name="plus" className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                Add New Exam Timer
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Set up a custom examination with your own sections and durations.
              </p>
            </div>
          </div>
        </main>
      ) : (
        /* VIEW 2: ACTIVE EXAM STAGE */
        <main className="flex-1 flex flex-col justify-between max-w-5xl w-full mx-auto px-6 py-6 gap-6">
          {/* Section Sequence Horizontal Stepper */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Exam Sections
              </span>
              <span className="text-xs text-slate-400">
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
                    className={`p-3.5 rounded-xl border transition-all ${
                      isEnded
                        ? "bg-slate-900/60 border-slate-700/50 text-slate-400"
                        : isActive
                        ? "bg-[#131b2e] border-blue-500 shadow-md text-white"
                        : "bg-slate-900/30 border-white/5 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold">{section.name}</span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          isEnded
                            ? "bg-emerald-500/20 text-emerald-300"
                            : isActive
                            ? "bg-blue-500 text-white"
                            : "bg-white/5 text-slate-400"
                        }`}
                      >
                        {isEnded ? "Ended" : isActive ? "Active" : "Pending"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{section.durationMinutes}m</span>
                      {isActive && (
                        <span className="font-mono font-bold text-blue-300">
                          {formatTimeRemaining(remainingSeconds)}
                        </span>
                      )}
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isEnded ? "w-full bg-emerald-500" : isActive ? "bg-blue-500" : "w-0"
                        }`}
                        style={{
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

          {/* Clean Total Exam Remaining Bar */}
          <div className="w-full px-5 py-3 rounded-xl bg-[#101624] border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Exam Remaining:
              </span>
              <span className="text-xl font-mono font-extrabold text-blue-400">
                {formatTimeRemaining(totalRemainingSeconds)}
              </span>
              <span className="text-xs text-slate-400">
                of {formatDurationLabel(totalExamMinutes)}
              </span>
            </div>

            <div className="flex-1 max-w-xs w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${totalProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Center Stage: Clear Section Headline & Massive Clean Digits */}
          <div className="flex-1 flex flex-col items-center justify-center my-2 text-center">
            {/* Bold, Clean Headline */}
            <div className="mb-2">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
                {hasExamFinished
                  ? "All Exam Sections Completed"
                  : isRunning
                  ? `${currentSection.name} Timer is Running`
                  : `${currentSection.name} Timer (Ready)`}
              </h2>
            </div>

            {/* Massive Digital Countdown */}
            <div className="my-2">
              <div
                className={`font-mono tabular-nums font-black tracking-tight leading-none text-8xl sm:text-9xl md:text-[12rem] transition-colors ${
                  hasExamFinished
                    ? "text-emerald-400"
                    : isDangerTime
                    ? "text-rose-400 animate-pulse"
                    : isWarningTime
                    ? "text-amber-300"
                    : "text-white"
                }`}
              >
                {hasExamFinished ? "00:00" : formatTimeRemaining(remainingSeconds)}
              </div>
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div className="w-full flex flex-col items-center gap-4 bg-[#101624] border border-white/10 rounded-2xl p-5 shadow-2xl">
            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 w-full">
              {/* Previous Section */}
              <button
                onClick={handlePrevSection}
                disabled={currentSectionIndex === 0}
                title="Return to previous section"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-30 disabled:pointer-events-none text-base font-bold transition-all min-h-[56px]"
              >
                <Icon name="chevronLeft" className="w-5 h-5" />
                <span>Prev Section</span>
              </button>

              {/* Main Play / Pause Button */}
              <button
                onClick={() => {
                  if (hasExamFinished) {
                    resetExam();
                  } else {
                    setIsRunning((r) => !r);
                  }
                }}
                title={isRunning ? "Pause exam timer" : "Start exam timer"}
                className={`flex items-center gap-3 px-10 py-4 rounded-xl font-extrabold text-lg transition-all shadow-lg min-h-[60px] ${
                  hasExamFinished
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : isRunning
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                <Icon
                  name={hasExamFinished ? "reset" : isRunning ? "pause" : "play"}
                  className="w-6 h-6"
                />
                <span>
                  {hasExamFinished
                    ? "Restart Exam"
                    : isRunning
                    ? "Pause Timer"
                    : "Start Exam"}
                </span>
              </button>

              {/* Skip to Next Section */}
              <button
                onClick={handleSkipNext}
                disabled={hasExamFinished}
                title="Finish current section and advance to next"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-30 disabled:pointer-events-none text-base font-bold transition-all min-h-[56px]"
              >
                <span>Next Section</span>
                <Icon name="forward" className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Adjustments & Manual Time Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 w-full pt-4 border-t border-white/10 text-sm">
              {/* Manual Time & Seconds Add/Subtract */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-400 mr-1 text-xs uppercase tracking-wider">
                  Adjust:
                </span>
                <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={manualAdjMins}
                    onChange={(e) => setManualAdjMins(e.target.value)}
                    aria-label="Adjust Minutes"
                    className="w-12 bg-transparent text-white font-mono text-center text-sm font-bold focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">m</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={manualAdjSecs}
                    onChange={(e) => setManualAdjSecs(e.target.value)}
                    aria-label="Adjust Seconds"
                    className="w-12 bg-transparent text-white font-mono text-center text-sm font-bold focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">s</span>
                </div>

                <button
                  onClick={() => handleApplyManualAdjustment(true)}
                  disabled={hasExamFinished}
                  title="Add entered time to active timer"
                  className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 font-bold text-xs transition-colors min-h-[36px]"
                >
                  + Add
                </button>
                <button
                  onClick={() => handleApplyManualAdjustment(false)}
                  disabled={hasExamFinished || remainingSeconds <= 1}
                  title="Subtract entered time from active timer"
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs transition-colors min-h-[36px] disabled:opacity-30"
                >
                  - Deduct
                </button>

                {/* Quick Shortcuts */}
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => handleAdjustSeconds(30)}
                    disabled={hasExamFinished}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-xs"
                  >
                    +30s
                  </button>
                  <button
                    onClick={() => handleAdjustSeconds(60)}
                    disabled={hasExamFinished}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-xs"
                  >
                    +1m
                  </button>
                  <button
                    onClick={() => handleAdjustSeconds(300)}
                    disabled={hasExamFinished}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-xs"
                  >
                    +5m
                  </button>
                </div>
              </div>

              {/* Reset Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetCurrentSection}
                  title="Reset current section timer to full duration"
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition-colors min-h-[36px]"
                >
                  Reset Section
                </button>
                <button
                  onClick={() => resetExam()}
                  title="Reset entire exam from Section A"
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors min-h-[36px]"
                >
                  Reset Exam
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Add / Edit Preset Drawer Modal */}
      {isEditorOpen && editingPreset && (
        <PresetEditorModal
          preset={editingPreset}
          onSave={handleSaveEditedPreset}
          onDelete={handleDeletePreset}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingPreset(null);
          }}
        />
      )}
    </div>
  );
}

// Preset Editor Modal Component
function PresetEditorModal({
  preset,
  onSave,
  onDelete,
  onClose,
}: {
  preset: ExamPreset;
  onSave: (preset: ExamPreset) => void;
  onDelete: (presetId: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(preset.title);
  const [description, setDescription] = useState(preset.description || "");
  const [sections, setSections] = useState<ExamSection[]>(preset.sections);

  const handleAddSection = () => {
    const nextLetter = String.fromCharCode(65 + sections.length);
    setSections([
      ...sections,
      {
        id: "sec-" + Date.now(),
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
    value: string | number
  ) => {
    setSections(
      sections.map((s, i) => {
        if (i !== index) return s;
        return {
          ...s,
          [field]: field === "durationMinutes" ? Math.max(1, Number(value) || 1) : value,
        };
      })
    );
  };

  const totalMins = sections.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || sections.length === 0) return;
    onSave({
      ...preset,
      title: title.trim(),
      description: description.trim(),
      sections,
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#0f1523] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141b2d]">
          <div>
            <h3 className="text-lg font-bold text-white">
              {preset.id.startsWith("preset-")
                ? "Create Exam Timer"
                : "Edit Exam Schedule"}
            </h3>
            <p className="text-xs text-slate-400">
              Set section names and minute durations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Exam Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. NSU Final Examination"
              className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm font-medium"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 4-section exam with automated transitions"
              className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          {/* Sections List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Sections & Durations ({sections.length})
              </label>
              <span className="text-xs font-mono font-bold text-blue-400">
                Total: {totalMins}m ({formatDurationLabel(totalMins)})
              </span>
            </div>

            <div className="space-y-2.5">
              {sections.map((section, idx) => (
                <div
                  key={section.id || idx}
                  className="flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-white/5"
                >
                  <span className="text-xs font-bold text-slate-400 w-6 text-center">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    value={section.name}
                    onChange={(e) => handleUpdateSection(idx, "name", e.target.value)}
                    placeholder="Section Name"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      required
                      min={1}
                      max={360}
                      value={section.durationMinutes}
                      onChange={(e) =>
                        handleUpdateSection(idx, "durationMinutes", e.target.value)
                      }
                      className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400">min</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(idx)}
                    disabled={sections.length <= 1}
                    title="Delete this section"
                    className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/20 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddSection}
              className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-white/20 hover:border-blue-400 hover:bg-blue-500/10 text-blue-300 text-xs font-medium transition-colors w-full justify-center"
            >
              <Icon name="plus" className="w-4 h-4" />
              Add Another Section
            </button>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            {!preset.isBuiltin && (
              <button
                type="button"
                onClick={() => onDelete(preset.id)}
                className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
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
