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

  const totalExamMinutes = calculateTotalExamDurationMinutes(activePreset);

  // Time warning states
  const isDangerTime = !hasExamFinished && remainingSeconds <= 60 && remainingSeconds > 0;
  const isWarningTime = !hasExamFinished && remainingSeconds <= 300 && remainingSeconds > 60;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col text-[#47322d] select-none overflow-y-auto"
      style={{
        backgroundColor: "#f3e9dc",
        colorScheme: "light",
        backgroundImage: "radial-gradient(#dec9b8 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#e2d2c1] bg-[#fbf5ed]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#a9746e] text-[#fbf7f4] shadow-sm">
            <Icon name="timer" className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#47322d]">
                {isChoosingPreset ? "Exam Timer" : activePreset.title}
              </h1>
              {!isChoosingPreset && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-[#ebdcc9] text-[#78544c] border border-[#ddcbba]">
                  {formatDurationLabel(totalExamMinutes)} Total
                </span>
              )}
            </div>
            <p className="text-xs text-[#8f6e66]">
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
              onClick={() => setIsChoosingPreset(true)}
              title="Return to timer selection menu"
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#d9c7b4] bg-[#fbf5ed] hover:bg-[#ebdcc9] text-[#6b4941] text-sm font-semibold transition-all min-h-[44px]"
            >
              <Icon name="chevronLeft" className="w-4 h-4 text-[#8f6e66]" />
              <span>Change Timer</span>
            </button>
          ) : (
            <button
              onClick={openNewPresetEditor}
              title="Add a new custom exam schedule"
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#a9746e] hover:bg-[#97645e] text-white text-sm font-semibold transition-all min-h-[44px] shadow-sm"
            >
              <Icon name="plus" className="w-4 h-4" />
              <span>Add New Timer</span>
            </button>
          )}

          {!isChoosingPreset && (
            <button
              onClick={() => openEditPreset(activePreset)}
              title="Edit this exam schedule"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-[#d9c7b4] bg-[#fbf5ed] hover:bg-[#ebdcc9] text-[#6b4941] text-sm font-medium transition-all min-h-[44px]"
            >
              <Icon name="edit" className="w-4 h-4 text-[#8f6e66]" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {/* Live Wall Clock */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#ebdcc9]/80 border border-[#ddcbba] text-[#6b4941] font-mono text-sm shadow-inner min-h-[44px]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#a9746e]" />
            <span className="text-[#8f6e66] text-xs hidden md:inline">Clock:</span>
            <span className="font-bold text-[#47322d] text-sm">{currentTimeStr}</span>
          </div>

          {/* Mute Chime Toggle */}
          <button
            onClick={() => setIsMuted((m) => !m)}
            title={isMuted ? "Unmute sound alert" : "Mute sound alert"}
            className={`p-2.5 rounded-2xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isMuted
                ? "border-[#c85a4b]/40 bg-[#f7e4e1] text-[#b34839]"
                : "border-[#d9c7b4] bg-[#fbf5ed] text-[#6b4941] hover:bg-[#ebdcc9]"
            }`}
          >
            <Icon name={isMuted ? "bellOff" : "bell"} className="w-5 h-5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="p-2.5 rounded-2xl border border-[#d9c7b4] bg-[#fbf5ed] hover:bg-[#ebdcc9] text-[#6b4941] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Icon name={isFullscreen ? "shrink" : "expand"} className="w-5 h-5" />
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            title="Exit Exam Timer"
            className="p-2.5 rounded-2xl border border-[#d9c7b4] bg-[#fbf5ed] hover:bg-[#f2dbd7] hover:text-[#a83224] text-[#6b4941] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* VIEW 1: PRESET SELECTION HUB */}
      {isChoosingPreset ? (
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-start gap-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-[#47322d] tracking-tight">
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
                  className="flex flex-col justify-between p-6 rounded-2xl border border-[#d9c7b4] bg-[#fbf5ed] shadow-md hover:border-[#a9746e] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-xl font-bold text-[#47322d]">{preset.title}</h3>
                      {isNsu && (
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#a9746e]/15 text-[#8f5a52] border border-[#a9746e]/30">
                          Standard
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[#8f6e66] mb-5">
                      {preset.sections.length} Sections · Total Duration: {formatDurationLabel(totalMins)}
                    </p>

                    {/* Section Breakdown List */}
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {preset.sections.map((sec, idx) => (
                        <div
                          key={sec.id || idx}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f3e9dc] border border-[#e2d2c1] text-xs text-[#6b4941]"
                        >
                          <span className="font-medium">{sec.name}</span>
                          <span className="font-mono font-bold text-[#47322d]">
                            {sec.durationMinutes}m
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-4 border-t border-[#e2d2c1]">
                    <button
                      onClick={() => handleLaunchPreset(preset.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold text-sm bg-[#a9746e] hover:bg-[#97645e] text-white transition-all shadow-sm min-h-[46px]"
                    >
                      <Icon name="play" className="w-4 h-4" />
                      <span>Start {preset.title}</span>
                    </button>

                    <button
                      onClick={() => openEditPreset(preset)}
                      title="Edit timer sections"
                      className="p-3 rounded-2xl border border-[#d9c7b4] bg-[#faf4ec] hover:bg-[#ebdcc9] text-[#6b4941] transition-all min-h-[46px] min-w-[46px] flex items-center justify-center"
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
              className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[#d9c7b4] hover:border-[#a9746e] bg-[#fbf5ed]/50 hover:bg-[#fbf5ed] cursor-pointer transition-all text-center min-h-[260px] group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#ebdcc9] group-hover:bg-[#a9746e] text-[#6b4941] group-hover:text-white flex items-center justify-center mb-3 transition-colors">
                <Icon name="plus" className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#47322d] group-hover:text-[#a9746e] transition-colors">
                Add New Exam Timer
              </h3>
              <p className="text-xs text-[#8f6e66] mt-1 max-w-xs">
                Set up a custom examination with your own sections and durations.
              </p>
            </div>
          </div>
        </main>
      ) : (
        /* VIEW 2: ACTIVE EXAM STAGE */
        <main className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto px-6 py-6 sm:py-8 gap-6 sm:gap-8">
          {/* Section Sequence Horizontal Stepper */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#8f6e66]">
                Exam Sections
              </span>
              <span className="text-xs text-[#8f6e66] font-medium">
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
                    className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                      isEnded
                        ? "bg-[#ede2d5]/90 border-[#dfcebe] text-[#78574f]"
                        : isActive
                        ? "bg-[#fbf5ed] border-2 border-[#a9746e] shadow-[0_4px_16px_rgba(169,116,110,0.12)] text-[#47322d]"
                        : "bg-[#f7efe5]/70 border-[#e8d9cc] text-[#9b7b72]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold truncate pr-1">{section.name}</span>
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
                          isEnded
                            ? "bg-[#dccbc0] text-[#543b35]"
                            : isActive
                            ? "bg-[#a9746e] text-white"
                            : "bg-[#eae0d3] text-[#85655d]"
                        }`}
                      >
                        {isEnded ? "Ended" : isActive ? "Active" : "Pending"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#8f6e66]">
                      <span>{section.durationMinutes}m</span>
                      {isActive && (
                        <span className="font-mono font-bold text-[#a9746e]">
                          {formatTimeRemaining(remainingSeconds)}
                        </span>
                      )}
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full bg-[#ead9c7] h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isEnded ? "w-full bg-[#a9746e]/60" : isActive ? "bg-[#a9746e]" : "w-0"
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

          {/* Center Stage: Minimalist Pomodoro-Style Countdown (Image 2 Aesthetic) */}
          <div className="flex-1 flex flex-col items-center justify-center my-4 sm:my-6 text-center">
            {/* Prominent Section Headline */}
            <div className="mb-2 sm:mb-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-[0.2em] text-[#704b43] select-none drop-shadow-[0_1px_4px_rgba(112,75,67,0.12)]">
                {hasExamFinished ? "All Exam Sections Completed" : currentSection.name}
              </h2>
            </div>

            {/* Massive Digital Countdown */}
            <div className="my-2">
              <div
                className={`font-mono tabular-nums font-bold tracking-tight leading-none text-8xl sm:text-9xl md:text-[11rem] lg:text-[12.5rem] transition-colors drop-shadow-[0_2px_12px_rgba(169,116,110,0.18)] ${
                  hasExamFinished
                    ? "text-[#5a8067]"
                    : isDangerTime
                    ? "text-[#c85a4b] animate-pulse"
                    : isWarningTime
                    ? "text-[#c07d4b]"
                    : "text-[#a9746e]"
                }`}
              >
                {hasExamFinished ? "00:00" : formatTimeRemaining(remainingSeconds)}
              </div>
            </div>

            {/* Primary Action Buttons (Directly below timer, matching Image 2) */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
              {/* Previous Section */}
              <button
                onClick={handlePrevSection}
                disabled={currentSectionIndex === 0}
                title="Return to previous section"
                className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl border border-[#a9746e] bg-transparent hover:bg-[#a9746e]/10 active:scale-[0.98] text-[#a9746e] disabled:opacity-35 disabled:pointer-events-none font-semibold text-base transition-all min-h-[50px]"
              >
                <Icon name="chevronLeft" className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {/* Main Start / Pause Button */}
              <button
                onClick={() => {
                  if (hasExamFinished) {
                    resetExam();
                  } else {
                    setIsRunning((r) => !r);
                  }
                }}
                title={isRunning ? "Pause exam timer" : "Start exam timer"}
                className={`flex items-center justify-center gap-2.5 px-9 py-3.5 rounded-2xl font-semibold text-base sm:text-lg transition-all shadow-md active:scale-[0.98] min-h-[50px] min-w-[150px] ${
                  hasExamFinished
                    ? "bg-[#5a8067] hover:bg-[#4d6f58] text-white"
                    : isRunning
                    ? "bg-[#c07d4b] hover:bg-[#ac6f41] text-white"
                    : "bg-[#a9746e] hover:bg-[#97645e] text-white"
                }`}
              >
                <Icon
                  name={hasExamFinished ? "reset" : isRunning ? "pause" : "play"}
                  className="w-5 h-5"
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
                onClick={handleResetCurrentSection}
                title="Reset current section to starting duration"
                className="flex items-center justify-center gap-1.5 px-6 py-3.5 rounded-2xl border border-[#a9746e] bg-transparent hover:bg-[#a9746e]/10 active:scale-[0.98] text-[#a9746e] font-semibold text-base transition-all min-h-[50px] min-w-[100px]"
              >
                <span>Reset</span>
              </button>

              {/* Skip to Next Section */}
              <button
                onClick={handleSkipNext}
                disabled={hasExamFinished}
                title="Finish current section and advance to next"
                className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl border border-[#a9746e] bg-transparent hover:bg-[#a9746e]/10 active:scale-[0.98] text-[#a9746e] disabled:opacity-35 disabled:pointer-events-none font-semibold text-base transition-all min-h-[50px]"
              >
                <span>Next</span>
                <Icon name="chevronRight" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Secondary Quick Adjustments Row (Subtle, Clean, Non-intrusive) */}
          <div className="w-full max-w-2xl mx-auto px-5 py-3 rounded-2xl bg-[#fbf5ed]/80 border border-[#dfcebe] shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Quick Adjustments */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#8f6e66] mr-1 uppercase tracking-wider text-[11px]">
                Adjust:
              </span>
              <div className="flex items-center gap-1.5 bg-[#f3e9dc] border border-[#d9c7b4] rounded-xl px-2.5 py-1">
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={manualAdjMins}
                  onChange={(e) => setManualAdjMins(e.target.value)}
                  aria-label="Adjust Minutes"
                  style={{
                    backgroundColor: "transparent",
                    color: "#47322d",
                    colorScheme: "light",
                  }}
                  className="w-8 !bg-transparent !text-[#47322d] font-mono text-center text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-[#8f6e66] font-medium">m</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={manualAdjSecs}
                  onChange={(e) => setManualAdjSecs(e.target.value)}
                  aria-label="Adjust Seconds"
                  style={{
                    backgroundColor: "transparent",
                    color: "#47322d",
                    colorScheme: "light",
                  }}
                  className="w-8 !bg-transparent !text-[#47322d] font-mono text-center text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-[#8f6e66] font-medium">s</span>
              </div>

              <button
                onClick={() => handleApplyManualAdjustment(true)}
                disabled={hasExamFinished}
                title="Add entered time"
                className="px-2.5 py-1 rounded-xl bg-[#a9746e]/15 hover:bg-[#a9746e]/25 text-[#7a4e46] font-bold border border-[#a9746e]/30 transition-all"
              >
                + Add
              </button>
              <button
                onClick={() => handleApplyManualAdjustment(false)}
                disabled={hasExamFinished || remainingSeconds <= 1}
                title="Subtract entered time"
                className="px-2.5 py-1 rounded-xl bg-[#f3e9dc] hover:bg-[#ebdcc9] text-[#7a4e46] font-bold border border-[#d9c7b4] transition-all disabled:opacity-40"
              >
                - Deduct
              </button>

              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => handleAdjustSeconds(30)}
                  disabled={hasExamFinished}
                  className="px-2 py-1 rounded-xl bg-[#f3e9dc] hover:bg-[#ebdcc9] border border-[#d9c7b4] text-[#7a4e46] font-mono text-[11px] transition-all"
                >
                  +30s
                </button>
                <button
                  onClick={() => handleAdjustSeconds(60)}
                  disabled={hasExamFinished}
                  className="px-2 py-1 rounded-xl bg-[#f3e9dc] hover:bg-[#ebdcc9] border border-[#d9c7b4] text-[#7a4e46] font-mono text-[11px] transition-all"
                >
                  +1m
                </button>
                <button
                  onClick={() => handleAdjustSeconds(300)}
                  disabled={hasExamFinished}
                  className="px-2 py-1 rounded-xl bg-[#f3e9dc] hover:bg-[#ebdcc9] border border-[#d9c7b4] text-[#7a4e46] font-mono text-[11px] transition-all"
                >
                  +5m
                </button>
              </div>
            </div>

            {/* Reset Exam */}
            <button
              onClick={() => resetExam()}
              title="Reset entire exam from Section A"
              className="px-3 py-1 rounded-xl bg-[#f5e3e0] hover:bg-[#eed3cf] border border-[#e5bdb6] text-[#9e463b] font-semibold text-xs transition-all"
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#fbf5ed] border border-[#d9c7b4] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#47322d]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2d2c1] bg-[#f4ebe0]">
          <div>
            <h3 className="text-lg font-bold text-[#47322d]">
              {preset.id.startsWith("preset-")
                ? "Create Exam Timer"
                : "Edit Exam Schedule"}
            </h3>
            <p className="text-xs text-[#8f6e66]">
              Set section names and minute durations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8f6e66] hover:text-[#47322d] hover:bg-[#ebdcc9] transition-colors"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78544c] mb-1.5">
              Exam Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. NSU Final Examination"
              style={{ backgroundColor: "#f3e9dc", color: "#47322d", colorScheme: "light" }}
              className="w-full px-4 py-2.5 rounded-xl !bg-[#f3e9dc] border border-[#d9c7b4] !text-[#47322d] placeholder-[#a4847b] focus:outline-none focus:border-[#a9746e] text-sm font-medium"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78544c] mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 4-section exam with automated transitions"
              style={{ backgroundColor: "#f3e9dc", color: "#47322d", colorScheme: "light" }}
              className="w-full px-4 py-2 rounded-xl !bg-[#f3e9dc] border border-[#d9c7b4] !text-[#47322d] placeholder-[#a4847b] focus:outline-none focus:border-[#a9746e] text-xs"
            />
          </div>

          {/* Sections List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#78544c]">
                Sections & Durations ({sections.length})
              </label>
              <span className="text-xs font-mono font-bold text-[#a9746e]">
                Total: {totalMins}m ({formatDurationLabel(totalMins)})
              </span>
            </div>

            <div className="space-y-2.5">
              {sections.map((section, idx) => (
                <div
                  key={section.id || idx}
                  className="flex items-center gap-2 p-2 rounded-xl bg-[#f3e9dc] border border-[#e2d2c1]"
                >
                  <span className="text-xs font-bold text-[#8f6e66] w-6 text-center">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    value={section.name}
                    onChange={(e) => handleUpdateSection(idx, "name", e.target.value)}
                    placeholder="Section Name"
                    style={{ backgroundColor: "#fbf5ed", color: "#47322d", colorScheme: "light" }}
                    className="flex-1 px-3 py-1.5 rounded-lg !bg-[#fbf5ed] border border-[#d9c7b4] !text-[#47322d] text-sm focus:outline-none focus:border-[#a9746e]"
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
                      style={{ backgroundColor: "#fbf5ed", color: "#47322d", colorScheme: "light" }}
                      className="w-20 px-3 py-1.5 rounded-lg !bg-[#fbf5ed] border border-[#d9c7b4] !text-[#47322d] text-sm font-mono text-center focus:outline-none focus:border-[#a9746e]"
                    />
                    <span className="text-xs text-[#8f6e66]">min</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(idx)}
                    disabled={sections.length <= 1}
                    title="Delete this section"
                    className="p-2 rounded-lg text-[#b85447] hover:bg-[#f3dbd7] disabled:opacity-20 disabled:pointer-events-none transition-colors"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddSection}
              className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#d9c7b4] hover:border-[#a9746e] hover:bg-[#a9746e]/10 text-[#a9746e] text-xs font-medium transition-colors w-full justify-center"
            >
              <Icon name="plus" className="w-4 h-4" />
              Add Another Section
            </button>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[#e2d2c1]">
            {!preset.isBuiltin && (
              <button
                type="button"
                onClick={() => onDelete(preset.id)}
                className="px-3 py-2 rounded-xl bg-[#f5e3e0] hover:bg-[#eed3cf] text-[#9e463b] text-xs font-semibold transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#d9c7b4] hover:bg-[#ebdcc9] text-[#6b4941] text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#a9746e] hover:bg-[#97645e] text-white text-sm font-bold transition-colors shadow-sm"
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
