# Phoenix Smartboard

<div align="center">

**A modern, offline-first digital smartboard and classroom whiteboard platform for interactive displays, desktop PCs, and mobile devices.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](tsconfig.json)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![PWA](https://img.shields.io/badge/PWA-Offline%20First-success)](https://web.dev/progressive-web-apps/)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Windows%20%7C%20Android-lightgrey)](#multiplatform-support)

[Getting Started](#getting-started) • [Features](#key-features) • [STEM Suite](#stem-tools--simulations) • [File Formats](#native--ps-file-format) • [Architecture](#architecture)

</div>

---

## Overview

**Phoenix Smartboard** (`com.phoenix.smartboard`) is an independent, open-source educational whiteboard platform designed specifically for interactive displays, smart classrooms, teachers, and students. It combines the responsiveness of desktop whiteboard hardware with the flexibility and portability of modern web and native technologies.

Phoenix Smartboard runs **100% locally and offline**:
- No accounts, subscriptions, or logins required.
- Zero analytics, telemetry, or third-party trackers.
- Complete data ownership: lessons remain entirely stored on your local device.

---

## Key Features

### 🖌️ Natural Whiteboard & Canvas
- **Pressure-Sensitive Inking**: Smooth stroke rendering with velocity sensitivity and palm rejection.
- **Rich Brush Library**: Ballpoint pen, calligraphy brush, watercolor brush, texture pen, chisel highlighter, and laser pointer.
- **Custom Pen Workshop**: Design and customize pen textures, lighting, and stroke dynamics, and export them as `.ps-pen` presets.
- **Slide & Page Management**: Multi-page lesson organizer with drag-and-drop thumbnail reordering, page duplication, and quick navigation.

### 📐 STEM Tools & Simulations
- **Virtual Geometry Instruments**:
  - Translucent **Ruler** with metric and imperial graduations.
  - **180° Protractor** with angle snap and rotation handle.
  - **45° and 60° Set Squares** with edge alignment.
  - **Compass** with adjustable radius for drawing perfect arcs and circles.
- **Chemistry Laboratory**:
  - Dynamic glassware: beakers, flasks, test tubes, and graduated cylinders.
  - Liquid level control, realistic meniscus rendering, and solution pouring.
  - Acid-base titration simulation with realistic indicator color transitions (Phenolphthalein, Bromothymol Blue, Methyl Orange).
- **Interactive Periodic Table**:
  - Complete 118-element IUPAC table with atomic numbers, masses, electron configurations, and oxidation states.
  - Element family and block filtering (alkali metals, halogens, noble gases, transition metals, etc.).
- **Physics Ray Optics Simulator**:
  - Real-time optical bench with light sources, flat mirrors, concave/convex mirrors, and converging/diverging lenses.
  - Accurate ray tracing calculating Snell's law refraction and specular reflection angles.
- **Physics DC Circuit Simulator**:
  - Interactive breadboard with DC voltage sources, resistors, SPST switches, incandescent bulbs, voltmeters, and ammeters.
  - Live Kirchhoff loop solver calculating current, node voltages, and bulb luminosity.

### 🎓 Classroom Presentation Suite
- **Engagement Tools**: Focus Spotlight, Reveal Curtain, Stopwatch, Countdown Timer, Dice Roller, and Random Student Name Picker.
- **Scientific Calculator**: Built-in expression evaluation with trigonometric, logarithmic, and algebraic functions.

- **Interactive Worksheets**: Embedded spreadsheets with formula calculations (`SUM`, `AVERAGE`, `IF`, etc.) and CSV/Excel import.

---

## Native `.ps` File Format

Phoenix Smartboard uses the modern, open **`.ps`** format (`application/vnd.phoenix-smartboard+json`):
- Single-file portable lesson archives containing vector strokes, background settings, multi-page slides, and embedded assets.
- Human-readable JSON structure allowing programmatic creation and inspection.
- **Broad Compatibility**: Seamlessly opens `.ps` and `.enb` lesson archives without data loss.

### Universal Document Converter
Import existing educational materials directly into your canvas:
- **PDF Documents** (`.pdf`)
- **Microsoft PowerPoint** (`.pptx`)
- **Microsoft Word** (`.docx`)
- **Microsoft Excel** (`.xlsx` / `.csv`)
- **Images** (`.png`, `.jpg`, `.svg`, `.webp`)

---

## Multiplatform Support

Phoenix Smartboard is designed to deliver a native experience across three primary environments:

| Platform | Runtime | Features |
|---|---|---|
| **Web (PWA)** | Modern Browsers | Offline-capable service worker, IndexedDB storage (`phoenix-smartboard-db`), installable PWA. |
| **Desktop** | Electron 40+ | Native windowing, transparent desktop screen annotation overlay, automatic folder backup (`.psbackup`). |
| **Android** | Capacitor 8+ | Hardware back-button handling, memory pressure management (2 GB / 4 GB / 8 GB budgets), native overlay service. |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 20 or higher recommended)
- `npm` (v10+)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/phoenix-smartboard/phoenix-smartboard.git
cd phoenix-smartboard
npm install
```

### Running the Development Server

Start the local Vite development server:

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

### Building for Production

Compile TypeScript and build the optimized production web assets:

```bash
npm run build
```

Production output will be generated in the `dist/` directory.

### Running Desktop Application

To launch the Electron desktop app in development:

```bash
npm run desktop
```

To build a standalone Windows installer (`.exe`):

```bash
npm run desktop:build
```

### Building for Android

Sync the web build to the Capacitor Android project:

```bash
npm run android:sync
```

Open the Android project in Android Studio or build with Gradle:

```bash
cd android
./gradlew assembleDebug
```

---

## Testing & Quality Assurance

Phoenix Smartboard includes a comprehensive test suite covering canvas geometry, persistence, lesson conversions, and device rendering:

```bash
# Typecheck TypeScript files
npm run typecheck

# Run unit and integration tests
npm test

# Run privacy and clean-source validations
npm run check:privacy
npm run check:release
```

---

## Contributing

We welcome contributions from educators, developers, and designers! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and development workflows, and read our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

Phoenix Smartboard is released under the [MIT License](LICENSE).
Third-party component notices and licenses are documented in [THIRD_PARTY.md](THIRD_PARTY.md).
