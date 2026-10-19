# Phoenix Smartboard identity

The Phoenix Smartboard brand identity features flame crimson (`#e63946`), amber glow (`#f4a261`), obsidian ink (`#111214`), and warm chalk (`#fdfbf7`), designed for clarity and legibility across classroom smartboards, tablets, and desktop displays.

- `logo.svg`: primary wordmark, suitable for README pages and release artwork.
- `../public/icon.svg`: square application mark and browser favicon.
- `../public/icon-192.png`, `../public/icon-512.png`, and `../public/icon-maskable-512.png`: installable web app icons.
- `icon.ico`: Windows installer and executable icon, with seven sizes from 16 to 256 pixels.
- `android/`: five launcher density sizes plus the adaptive foreground vector.

Both SVGs are included under the project's MIT license. Keep the mark's aspect ratio and leave clear space around it. Teachers can still customize the application appearance in Settings.

Run `node scripts/generate-branding.mjs` after editing the original SVG. This uses the development Playwright dependency and a local Edge browser; set `PLAYWRIGHT_CHANNEL` for a different installed browser. Run `node scripts/apply-native-branding.mjs` after `npx cap add android` to apply the checked-in Android assets. Ordinary builds use the assets already included in the repository and do not need the generator.

Android builds apply adaptive and round launcher icons, Android 13 themed icons, and a branded startup screen with the Phoenix mark. The startup mark stays within the system splash safe area in portrait and landscape. The AndroidX launch theme hands off to the Capacitor app without a forced delay.
