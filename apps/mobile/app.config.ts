import type { ConfigContext, ExpoConfig } from "expo/config";

/** Reject shipping LAN / localhost API URLs in EAS binaries. */
const LOCAL_OR_LAN =
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?\/?$/i;

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim();
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnon = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const isEas = process.env.EAS_BUILD === "true";

  if (isEas) {
    if (!apiUrl) {
      throw new Error(
        "EAS build requires EXPO_PUBLIC_API_URL — public https URL of the hosted FINPA Business backend (not your PC LAN IP).",
      );
    }
    if (LOCAL_OR_LAN.test(apiUrl)) {
      throw new Error(
        `EAS build cannot use a local/LAN API URL (${apiUrl}). Host apps/backend and set EXPO_PUBLIC_API_URL to that public https URL.`,
      );
    }
    if (!supabaseUrl || !supabaseAnon) {
      throw new Error(
        "EAS build requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for live auth.",
      );
    }
  }

  return {
    ...config,
    name: config.name ?? "FINPA Business",
    slug: config.slug ?? "finpa-business",
    scheme: config.scheme ?? "finpa-business",
    android: {
      ...config.android,
      // Allow http only for local/LAN dev; production should use https
      ...( {
        usesCleartextTraffic: !apiUrl || apiUrl.startsWith("http://"),
      } as ExpoConfig["android"]),
    },
    extra: {
      ...config.extra,
      apiUrl: apiUrl || null,
      supabaseConfigured: Boolean(supabaseUrl && supabaseAnon),
    },
  };
};
