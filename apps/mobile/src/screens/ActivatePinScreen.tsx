import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { NavigationContext } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ApiError, getApiUrl, redeemPin } from "../lib/api";
import { showDevUi } from "../lib/env";
import type { ThemeColors } from "../theme/colors";

const DEMO_PINS = new Set(["BUS-DEMO-0001", "FINPA-DEMO-0001"]);

export function ActivatePinScreen() {
  const navigation = React.useContext(NavigationContext);
  const canGoBack = Boolean(navigation?.canGoBack());
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token, profile, setProfileLocal, signOut, isDevAuth } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const unlockDevOffline = (pin: string) => {
    // Offline demo unlock only in local/dev auth — never in release APKs
    if (!showDevUi || !isDevAuth || !profile) return false;
    if (!DEMO_PINS.has(pin)) return false;
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    setProfileLocal(
      {
        ...profile,
        subscription_period: "monthly",
        subscription_expires_at: expires.toISOString(),
        activated_at: profile.activated_at ?? new Date().toISOString(),
      },
      true,
    );
    setSuccess("Dev offline unlock — monthly demo active");
    return true;
  };

  const activate = async () => {
    if (!token) return;
    const pin = code.trim().toUpperCase();
    setBusy(true);
    setError(null);
    try {
      const result = await redeemPin(token, pin);
      setSuccess(result.summary);
      setProfileLocal(result.profile, result.subscriptionActive);
      if (canGoBack) navigation?.goBack();
    } catch (err) {
      if (unlockDevOffline(pin)) return;
      const msg =
        err instanceof ApiError ? err.message : "Could not activate PIN";
      const unreachable =
        /could not reach|network|failed to fetch|ECONNREFUSED/i.test(msg);
      setError(
        unreachable && showDevUi
          ? `${msg}\n\nPhone and PC must be on the same Wi‑Fi. Current API: ${getApiUrl()}. Restart Expo after changing .env. If Wi‑Fi is “Public”, set it to Private or allow port 3001 in Windows Firewall.`
          : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={colors.gradient} style={styles.root}>
      <StatusBar style={colors.statusBar} />
      <View style={styles.inner}>
        {canGoBack ? (
          <Pressable onPress={() => navigation?.goBack()} style={styles.back}>
            <ArrowLeft size={20} color={colors.mist} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : null}
        <BrandMark size={108} style={styles.logo} />
        <Text style={styles.tagline}>Business sales, expenses, and profit</Text>
        <Text style={styles.lead}>Enter your Activation Pin</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="characters"
          placeholder="BUS-XXXX-XXXX"
          placeholderTextColor={colors.mistMuted}
          value={code}
          onChangeText={setCode}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable style={styles.cta} onPress={activate} disabled={busy || !code.trim()}>
          {busy ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.ctaText}>Activate</Text>
          )}
        </Pressable>

        <Pressable onPress={() => signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>

        {showDevUi ? (
          <>
            <Text style={styles.dev}>API: {getApiUrl()}</Text>
            <Text style={styles.devHint}>
              Demo PIN: BUS-DEMO-0001
              {isDevAuth
                ? " · if Activate fails, demo PIN still unlocks offline in dev mode"
                : ""}
            </Text>
          </>
        ) : null}
      </View>
    </LinearGradient>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    inner: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    backText: { color: c.mistMuted, fontFamily: "DMSans_400Regular" },
    logo: {
      alignSelf: "flex-start",
    },
    tagline: {
      marginTop: 16,
      color: c.sageBright,
      fontFamily: "DMSans_500Medium",
      fontSize: 15,
    },
    lead: {
      marginTop: 18,
      marginBottom: 28,
      color: c.mistMuted,
      fontFamily: "DMSans_400Regular",
      fontSize: 15,
      lineHeight: 22,
    },
    input: {
      backgroundColor: c.inkCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.line,
      color: c.mist,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontFamily: "DMSans_500Medium",
      fontSize: 18,
      letterSpacing: 1,
    },
    cta: {
      marginTop: 16,
      backgroundColor: c.sageBright,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    ctaText: {
      color: c.ink,
      fontFamily: "DMSans_700Bold",
      fontSize: 16,
    },
    error: {
      marginTop: 10,
      color: c.danger,
      fontFamily: "DMSans_400Regular",
    },
    success: {
      marginTop: 10,
      color: c.income,
      fontFamily: "DMSans_400Regular",
    },
    signOut: {
      marginTop: 24,
      textAlign: "center",
      color: c.mistMuted,
      fontFamily: "DMSans_400Regular",
    },
    dev: {
      marginTop: 28,
      color: c.mistMuted,
      fontSize: 11,
      fontFamily: "DMSans_400Regular",
      opacity: 0.8,
      textAlign: "center",
    },
    devHint: {
      marginTop: 6,
      color: c.mistMuted,
      fontSize: 11,
      fontFamily: "DMSans_400Regular",
      opacity: 0.65,
      textAlign: "center",
    },
  });
}
