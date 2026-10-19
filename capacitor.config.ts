import type { CapacitorConfig } from '@capacitor/cli';
import { BRANDING } from './src/config/branding';

const config: CapacitorConfig = {
  appId: BRANDING.BUNDLE_ID,
  appName: BRANDING.APP_NAME,
  webDir: 'dist',
  android: { backgroundColor: BRANDING.COLORS.DARK }
};
export default config;

