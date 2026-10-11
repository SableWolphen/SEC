import type { CapacitorConfig } from '@capacitor/cli';

// Set the permanent app ID before generating native projects or submitting to stores.
// com.example.* is a LOCAL DEVELOPMENT PLACEHOLDER, not a release identifier.
const config: CapacitorConfig = {
  appId: process.env.SEC_MOBILE_APP_ID || 'com.example.secpickem',
  appName: process.env.SEC_MOBILE_APP_NAME || 'SEC Pick’em — Unofficial',
  webDir: 'mobile-dist',
  bundledWebRuntime: false,
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false }
};

export default config;
