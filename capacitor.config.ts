import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carei.app',
  appName: 'CAREi',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f1a2e',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f1a2e',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
