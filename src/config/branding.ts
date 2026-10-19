// Phoenix Smartboard - Central Branding & Identity Configuration
// Single source of truth for all application metadata, file formats, and storage keys.

export const BRANDING = {
  APP_NAME: 'Phoenix Smartboard',
  APP_SHORT_NAME: 'Phoenix',
  APP_SLOGAN: 'Ignite your classroom. Your lesson, your way.',
  APP_VERSION: '1.0.0',
  PACKAGE_NAME: 'phoenix-smartboard',
  BUNDLE_ID: 'com.phoenix.smartboard',
  
  // Native File Format Specification
  FILE_EXTENSION: '.ps',
  FILE_EXTENSION_NO_DOT: 'ps',
  MIME_TYPE: 'application/vnd.phoenix-smartboard+json',

  // Storage Identifiers
  DB_NAME: 'phoenix-smartboard-db',
  STORAGE_PREFIX: 'phoenix',
  STORAGE_KEYS: {
    SELECTION_SETTINGS: 'phoenix-selection-settings',
    ERASER_MODE: 'phoenix-eraser-mode',
    PALM_ERASER: 'phoenix-palm-eraser',
    THEME: 'phoenix-theme',
    PEN_PRESETS: 'phoenix-pen-presets',
    RECENT_LESSONS: 'phoenix-recent-lessons',
    DISPLAY_PREFERENCES: 'phoenix-display-preferences',
  },

  // Color Palette Constants
  COLORS: {
    PRIMARY: '#e63946', // Phoenix Crimson
    ACCENT: '#2a9d8f', // Phoenix Teal
    DARK: '#111214',
    OBSIDIAN: '#1e293b',
    CHALKBOARD_GREEN: '#1a4331',
    PAPER: '#f5f1e6',
  },

  // Author & Links
  CREDITS: {
    ORGANIZATION: 'Phoenix Smartboard Team',
    DOCS_URL: 'https://github.com/phoenix-smartboard/phoenix-smartboard',
    ISSUES_URL: 'https://github.com/phoenix-smartboard/phoenix-smartboard/issues',
    RELEASES_URL: 'https://github.com/phoenix-smartboard/phoenix-smartboard/releases',
  }
} as const;

export type BrandingConfig = typeof BRANDING;
