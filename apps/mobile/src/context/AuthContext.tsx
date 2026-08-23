import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthRedirectUrl } from "../lib/authRedirect";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { fetchMe } from "../lib/api";
import {
  isSubscriptionActiveLocal,
  loadAuthSnapshot,
  saveAuthSnapshot,
} from "../lib/authSnapshot";
import type { Profile } from "../types";

const DEV_SESSION_KEY = "finpa-business.dev.session";

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  profile: Profile | null;
  subscriptionActive: boolean;
  isSuperAdmin: boolean;
  isDevAuth: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfileLocal: (profile: Profile, subscriptionActive: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function makeDevProfile(userId: string, email: string): Profile {
  return {
    id: userId,
    email,
    preferred_currency: "NGN",
    subscription_period: null,
    subscription_expires_at: null,
    activated_at: null,
    created_at: new Date().toISOString(),
  };
}

function applyLocalEntitlements(profile: Profile, isSuperAdmin: boolean) {
  return {
    subscriptionActive:
      isSuperAdmin || isSubscriptionActiveLocal(profile),
    isSuperAdmin,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const persistSnapshot = useCallback(
    async (
      nextProfile: Profile,
      active: boolean,
      admin: boolean,
    ) => {
      await saveAuthSnapshot(nextProfile.id, {
        profile: nextProfile,
        subscriptionActive: active,
        isSuperAdmin: admin,
      });
    },
    [],
  );

  const restoreFromSnapshot = useCallback(async (userId: string) => {
    const snap = await loadAuthSnapshot(userId);
    if (!snap?.profile) return false;
    const entitlements = applyLocalEntitlements(
      snap.profile,
      Boolean(snap.isSuperAdmin),
    );
    setProfile(snap.profile);
    setSubscriptionActive(entitlements.subscriptionActive);
    setIsSuperAdmin(entitlements.isSuperAdmin);
    return entitlements.subscriptionActive || entitlements.isSuperAdmin;
  }, []);

  const hydrateFromToken = useCallback(
    async (accessToken: string, userIdHint?: string) => {
      try {
        const me = await fetchMe(accessToken);
        const admin = Boolean(me.isSuperAdmin);
        const active = Boolean(me.subscriptionActive) || admin;
        setToken(accessToken);
        setProfile(me.profile);
        setSubscriptionActive(active);
        setIsSuperAdmin(admin);
        await persistSnapshot(me.profile, active, admin);
      } catch {
        // Offline / API down: keep session and restore last known entitlements
        setToken(accessToken);
        const userId =
          userIdHint ||
          (await (async () => {
            if (isSupabaseConfigured && supabase) {
              const { data } = await supabase.auth.getSession();
              return data.session?.user?.id;
            }
            return undefined;
          })());

        if (userId) {
          const restored = await restoreFromSnapshot(userId);
          if (restored) return;
        }

        // Dev session may already have a profile in memory path
        if (!userIdHint) {
          try {
            const raw = await AsyncStorage.getItem(DEV_SESSION_KEY);
            if (raw) {
              const parsed = JSON.parse(raw) as {
                profile?: Profile;
                subscriptionActive?: boolean;
                isSuperAdmin?: boolean;
              };
              if (parsed.profile) {
                const entitlements = applyLocalEntitlements(
                  parsed.profile,
                  Boolean(parsed.isSuperAdmin),
                );
                setProfile(parsed.profile);
                setSubscriptionActive(
                  entitlements.subscriptionActive ||
                    Boolean(parsed.subscriptionActive),
                );
                setIsSuperAdmin(entitlements.isSuperAdmin);
              }
            }
          } catch {
            // ignore
          }
        }
      }
    },
    [persistSnapshot, restoreFromSnapshot],
  );

  useEffect(() => {
    let mounted = true;
    let linkSub: { remove: () => void } | undefined;

    async function handleAuthUrl(url: string | null) {
      if (!url || !isSupabaseConfigured || !supabase || !mounted) return;

      try {
        const parsed = new URL(url);
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const code =
          parsed.searchParams.get("code") || hashParams.get("code");
        const accessToken =
          parsed.searchParams.get("access_token") ||
          hashParams.get("access_token");
        const refreshToken =
          parsed.searchParams.get("refresh_token") ||
          hashParams.get("refresh_token");

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data.session?.access_token && mounted) {
            await hydrateFromToken(
              data.session.access_token,
              data.session.user?.id,
            );
          }
          return;
        }

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (data.session?.access_token && mounted) {
            await hydrateFromToken(
              data.session.access_token,
              data.session.user?.id,
            );
          }
        }
      } catch (err) {
        console.warn(
          "[finpa-business] auth deep-link failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    async function boot() {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token && mounted) {
            await hydrateFromToken(
              data.session.access_token,
              data.session.user?.id,
            );
          }
          supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!mounted) return;
            if (session?.access_token) {
              await hydrateFromToken(session.access_token, session.user?.id);
            } else {
              setToken(null);
              setProfile(null);
              setSubscriptionActive(false);
              setIsSuperAdmin(false);
            }
          });

          const initialUrl = await Linking.getInitialURL();
          await handleAuthUrl(initialUrl);
          if (mounted) {
            linkSub = Linking.addEventListener("url", ({ url }) => {
              void handleAuthUrl(url);
            });
          }
        } else {
          const raw = await AsyncStorage.getItem(DEV_SESSION_KEY);
          if (raw && mounted) {
            const parsed = JSON.parse(raw) as {
              token: string;
              profile: Profile;
              subscriptionActive?: boolean;
              isSuperAdmin?: boolean;
            };
            setToken(parsed.token);
            try {
              const me = await fetchMe(parsed.token);
              const admin = Boolean(me.isSuperAdmin);
              const active = Boolean(me.subscriptionActive) || admin;
              setProfile(me.profile);
              setSubscriptionActive(active);
              setIsSuperAdmin(admin);
              await persistSnapshot(me.profile, active, admin);
              await AsyncStorage.setItem(
                DEV_SESSION_KEY,
                JSON.stringify({
                  token: parsed.token,
                  profile: me.profile,
                  subscriptionActive: active,
                  isSuperAdmin: admin,
                }),
              );
            } catch {
              const snap = await loadAuthSnapshot(parsed.profile.id);
              const profile = snap?.profile ?? parsed.profile;
              const admin = Boolean(
                snap?.isSuperAdmin ?? parsed.isSuperAdmin,
              );
              const entitlements = applyLocalEntitlements(profile, admin);
              setProfile(profile);
              setSubscriptionActive(
                entitlements.subscriptionActive ||
                  Boolean(parsed.subscriptionActive),
              );
              setIsSuperAdmin(entitlements.isSuperAdmin);
            }
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();
    return () => {
      mounted = false;
      linkSub?.remove();
    };
  }, [hydrateFromToken, persistSnapshot]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session?.access_token) {
          await hydrateFromToken(
            data.session.access_token,
            data.session.user?.id,
          );
        }
        return;
      }

      const userId = `dev-${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const accessToken = `dev:${userId}:${email}`;
      let nextProfile = makeDevProfile(userId, email);
      let active = false;
      let admin = false;
      try {
        const me = await fetchMe(accessToken);
        nextProfile = me.profile;
        active = Boolean(me.subscriptionActive);
        admin = Boolean(me.isSuperAdmin);
      } catch {
        const snap = await loadAuthSnapshot(userId);
        if (snap?.profile) {
          nextProfile = snap.profile;
          admin = Boolean(snap.isSuperAdmin);
          active =
            applyLocalEntitlements(nextProfile, admin).subscriptionActive ||
            Boolean(snap.subscriptionActive);
        }
      }
      active = active || admin || isSubscriptionActiveLocal(nextProfile);
      await AsyncStorage.setItem(
        DEV_SESSION_KEY,
        JSON.stringify({
          token: accessToken,
          profile: nextProfile,
          subscriptionActive: active,
          isSuperAdmin: admin,
        }),
      );
      await persistSnapshot(nextProfile, active, admin);
      setToken(accessToken);
      setProfile(nextProfile);
      setSubscriptionActive(active);
      setIsSuperAdmin(admin);
    },
    [hydrateFromToken, persistSnapshot],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAuthRedirectUrl() },
        });
        if (error) throw error;
        if (data.session?.access_token) {
          await hydrateFromToken(
            data.session.access_token,
            data.session.user?.id,
          );
        } else {
          await signIn(email, password).catch(() => {
            throw new Error(
              "Account created. Confirm your email if required, then sign in.",
            );
          });
        }
        return;
      }
      await signIn(email, password);
    },
    [hydrateFromToken, signIn],
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    await AsyncStorage.removeItem(DEV_SESSION_KEY);
    setToken(null);
    setProfile(null);
    setSubscriptionActive(false);
    setIsSuperAdmin(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const me = await fetchMe(token);
      const admin = Boolean(me.isSuperAdmin);
      const active = Boolean(me.subscriptionActive) || admin;
      setProfile(me.profile);
      setSubscriptionActive(active);
      setIsSuperAdmin(admin);
      await persistSnapshot(me.profile, active, admin);
    } catch {
      if (profile?.id) await restoreFromSnapshot(profile.id);
    }
  }, [token, profile?.id, persistSnapshot, restoreFromSnapshot]);

  const setProfileLocal = useCallback(
    (next: Profile, active: boolean) => {
      const admin = isSuperAdmin;
      const nextActive = active || admin || isSubscriptionActiveLocal(next);
      setProfile(next);
      setSubscriptionActive(nextActive);
      void persistSnapshot(next, nextActive, admin);
      if (!isSupabaseConfigured) {
        void AsyncStorage.getItem(DEV_SESSION_KEY).then((raw) => {
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            void AsyncStorage.setItem(
              DEV_SESSION_KEY,
              JSON.stringify({
                ...parsed,
                profile: next,
                subscriptionActive: nextActive,
                isSuperAdmin: admin,
              }),
            );
          } catch {
            // ignore
          }
        });
      }
    },
    [isSuperAdmin, persistSnapshot],
  );

  const value = useMemo(
    () => ({
      loading,
      token,
      profile,
      subscriptionActive,
      isSuperAdmin,
      isDevAuth: !isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      setProfileLocal,
    }),
    [
      loading,
      token,
      profile,
      subscriptionActive,
      isSuperAdmin,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      setProfileLocal,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
