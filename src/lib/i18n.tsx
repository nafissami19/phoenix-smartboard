"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "bn";

export const DICTIONARY: Record<Locale, Record<string, string>> = {
  en: {
    // Dock & Main Actions
    menu: "Menu",
    new_lesson: "New lesson",
    open: "Open…",
    save: "Save",
    saveas: "Save as",
    save_lesson: "Save lesson",
    insert_object: "Insert object",
    import_file: "Import file",
    export: "Export",
    print: "Print",
    settings: "Settings",
    themes: "Themes",
    help: "Help",
    about: "About",
    exit: "Exit to library",
    fullscreen: "Fullscreen",
    display_annotation: "Display annotation",
    treasure_box: "Treasure box",
    board_tools: "Board & tools",
    swap_sides: "Swap sides",

    // Toolbar & Tools
    pen: "Pen",
    highlighter: "Highlighter",
    marker: "Marker",
    laser: "Laser pointer",
    eraser: "Eraser",
    shapes: "Shapes",
    select: "Select",
    text: "Text",
    pan: "Pan board",
    undo: "Undo",
    redo: "Redo",
    clear: "Clear",
    lock: "Lock",
    unlock: "Unlock",
    group: "Group",
    ungroup: "Ungroup",

    // Library
    your_lessons: "Your lessons",
    lessons: "Lessons",
    pages: "Pages",
    subjects: "Subjects",
    search_lessons: "Search lessons or subjects",
    trash_recovery: "Trash / Recovery",
    restore: "Restore",
    delete: "Delete",
    delete_permanent: "Delete permanently",

    // Recorder
    record: "Record",
    pause: "Pause",
    resume: "Resume",
    done: "Done",
    mic: "Microphone",

    // Language
    language: "Language",
    english: "English",
    bangla: "বাংলা (Bangla)",
  },
  bn: {
    // Dock & Main Actions
    menu: "মেনু",
    new_lesson: "নতুন পাঠ",
    open: "খুলুন…",
    save: "সংরক্ষণ",
    saveas: "নতুন নামে সংরক্ষণ",
    save_lesson: "পাঠ সংরক্ষণ করুন",
    insert_object: "অবজেক্ট যুক্ত করুন",
    import_file: "ফাইল ইম্পোর্ট",
    export: "রপ্তানি (এক্সপোর্ট)",
    print: "প্রিন্ট করুন",
    settings: "সেটিংস",
    themes: "থিমসমূহ",
    help: "সাহায্য",
    about: "পরিচিতি",
    exit: "লাইব্রেরিতে ফিরে যান",
    fullscreen: "পূর্ণ পর্দা",
    display_annotation: "স্ক্রিন অ্যানোটেশন",
    treasure_box: "ট্রেজার বক্স",
    board_tools: "বোর্ড ও টুলস",
    swap_sides: "পাশ পরিবর্তন করুন",

    // Toolbar & Tools
    pen: "কলম (পেন)",
    highlighter: "হাইলাইটার",
    marker: "মার্কার",
    laser: "লেজার পয়েন্টার",
    eraser: "ইরেজার (মুছুন)",
    shapes: "জ্যামিতিক আকৃতি",
    select: "নির্বাচন করুন",
    text: "টেক্সট (লেখা)",
    pan: "বোর্ড সরান",
    undo: "পূর্বাবস্থায় ফেরান",
    redo: "পুনরায় করুন",
    clear: "সব পরিষ্কার করুন",
    lock: "লক করুন",
    unlock: "আনলক করুন",
    group: "গ্রুপ করুন",
    ungroup: "আনগ্রুপ করুন",

    // Library
    your_lessons: "আপনার পাঠসমূহ",
    lessons: "পাঠসমূহ",
    pages: "পৃষ্ঠাসমূহ",
    subjects: "বিষয়সমূহ",
    search_lessons: "পাঠ বা বিষয় খুঁজুন",
    trash_recovery: "ট্র্যাশ / রিকভারি",
    restore: "পুনরুদ্ধার করুন",
    delete: "মুছে ফেলুন",
    delete_permanent: "স্থায়ীভাবে মুছুন",

    // Recorder
    record: "রেকর্ড করুন",
    pause: "বিরতি দিন",
    resume: "আবার শুরু করুন",
    done: "সম্পন্ন",
    mic: "মাইক্রোফোন",

    // Language
    language: "ভাষা",
    english: "English",
    bangla: "বাংলা (Bangla)",
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key, fallback) => DICTIONARY.en[key] || fallback || key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("phoenix-locale");
        if (stored === "en" || stored === "bn") return stored;
      } catch {}
    }
    return "en";
  });

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("phoenix-locale", next);
        document.documentElement.lang = next;
      } catch {}
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = (key: string, fallback?: string): string => {
    return DICTIONARY[locale]?.[key] ?? DICTIONARY.en[key] ?? fallback ?? key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function translate(key: string, locale: Locale = "en", fallback?: string): string {
  return DICTIONARY[locale]?.[key] ?? DICTIONARY.en[key] ?? fallback ?? key;
}

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "en" ? "bn" : "en")}
      aria-label={`Switch language (currently ${locale === "en" ? "English" : "বাংলা"})`}
      title={`Switch language: ${locale === "en" ? "বাংলা" : "English"}`}
      className={`kn-focus inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-semibold text-ink hover:bg-elevated transition-colors ${
        className ?? ""
      }`}
    >
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {locale === "en" ? "EN" : "BN"}
      </span>
      <span>{locale === "en" ? "বাংলা" : "English"}</span>
    </button>
  );
}
