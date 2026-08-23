import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Eye, EyeOff } from "lucide-react-native";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/colors";
import { getApiUrl } from "../lib/api";
import { showDevUi } from "../lib/env";

export function AuthScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { signIn, signUp, isDevAuth } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={colors.gradient} style={styles.root}>
      <StatusBar style={colors.statusBar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.inner}
      >
        <BrandMark size={120} style={styles.logo} />
        <Text style={styles.tagline}>Business sales, expenses, and profit</Text>
        <Text style={styles.lead}>
          Record sales and expenses in seconds. See today&apos;s profit without a spreadsheet.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={colors.mistMuted}
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              placeholder="Password"
              placeholderTextColor={colors.mistMuted}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={8}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.mistMuted} />
              ) : (
                <Eye size={20} color={colors.mistMuted} />
              )}
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.cta} onPress={submit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.ctaText}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          >
            <Text style={styles.switch}>
              {mode === "signin"
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>

        {showDevUi && isDevAuth ? (
          <Text style={styles.dev}>
            Dev auth (no Supabase). API: {getApiUrl()}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
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
      marginTop: 10,
      marginBottom: 32,
      color: c.mistMuted,
      fontFamily: "DMSans_400Regular",
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 320,
    },
    form: { gap: 12 },
    input: {
      backgroundColor: c.inkCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.line,
      color: c.mist,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontFamily: "DMSans_400Regular",
      fontSize: 16,
    },
    passwordWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.inkCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.line,
    },
    passwordInput: {
      flex: 1,
      color: c.mist,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontFamily: "DMSans_400Regular",
      fontSize: 16,
    },
    eyeBtn: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    cta: {
      marginTop: 4,
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
    switch: {
      textAlign: "center",
      color: c.mistMuted,
      fontFamily: "DMSans_400Regular",
      marginTop: 8,
    },
    error: {
      color: c.danger,
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
    },
    dev: {
      marginTop: 28,
      color: c.mistMuted,
      fontSize: 11,
      fontFamily: "DMSans_400Regular",
      opacity: 0.7,
    },
  });
}
