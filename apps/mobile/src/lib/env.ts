/**
 * Dev chrome (API URL, demo PIN hints) only in local Expo / when explicitly enabled.
 * Release APKs from EAS have __DEV__ === false.
 */
export const APP_NAME = "FINPA Business";

export const showDevUi =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_UI === "1";

export const isReleaseBuild = !__DEV__;
