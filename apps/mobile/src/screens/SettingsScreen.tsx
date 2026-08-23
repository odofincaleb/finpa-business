import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { updateCurrency } from "../lib/api";
import { currencyLabel } from "../lib/currency";
import { CURRENCIES, type CurrencyCode } from "../types";
import type { ThemeColors } from "../theme/colors";
import type { RootStackParamList } from "../navigation/types";

export function SettingsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    profile,
    token,
    setProfileLocal,
    subscriptionActive,
    signOut,
    isDevAuth,
    isSuperAdmin,
  } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const select = async (code: CurrencyCode) => {
    if (!token || !profile || code === profile.preferred_currency) return;
    setBusy(code);
    try {
      const result = await updateCurrency(token, code);
      setProfileLocal(result.profile, result.subscriptionActive);
    } finally {
      setBusy(null);
    }
  };

  const expires = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.email}>{profile?.email}</Text>

        <Text style={styles.section}>Pages</Text>
        <View style={styles.list}>
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("Summary")}
          >
            <Text style={styles.rowText}>Monthly summary</Text>
            <Text style={styles.check}>Open</Text>
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("QuickTips")}
          >
            <Text style={styles.rowText}>Quick tips · chat instructions</Text>
            <Text style={styles.check}>Open</Text>
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("Debtors")}
          >
            <Text style={styles.rowText}>Debtors</Text>
            <Text style={styles.check}>Open</Text>
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("Ledger")}
          >
            <Text style={styles.rowText}>Full ledger</Text>
            <Text style={styles.check}>Open</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Subscription</Text>
        <Text style={styles.body}>
          {subscriptionActive
            ? `${profile?.subscription_period ?? "Active"} · until ${expires}`
            : isSuperAdmin
              ? "Super admin — PIN activation not required"
              : "Inactive — redeem a PIN to continue"}
        </Text>

        {isSuperAdmin ? (
          <>
            <Text style={styles.section}>Super Admin</Text>
            <View style={styles.list}>
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate("AdminPins")}
              >
                <Text style={styles.rowText}>Manage PINs</Text>
                <Text style={styles.check}>Open</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Appearance</Text>
        <View style={styles.list}>
          <Pressable
            style={[styles.row, mode === "light" && styles.rowSelected]}
            onPress={() => setMode("light")}
          >
            <Text style={styles.rowText}>Light</Text>
            {mode === "light" ? <Text style={styles.check}>Selected</Text> : null}
          </Pressable>
          <Pressable
            style={[styles.row, mode === "dark" && styles.rowSelected]}
            onPress={() => setMode("dark")}
          >
            <Text style={styles.rowText}>Dark</Text>
            {mode === "dark" ? <Text style={styles.check}>Selected</Text> : null}
          </Pressable>
        </View>

        <Text style={styles.section}>Currency</Text>
        <Text style={styles.hint}>Default is Naira. Applies to new entries and display.</Text>
        <View style={styles.list}>
          {CURRENCIES.map((code) => {
            const selected = profile?.preferred_currency === code;
            return (
              <Pressable
                key={code}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => select(code)}
              >
                <Text style={styles.rowText}>{currencyLabel(code)}</Text>
                {busy === code ? (
                  <ActivityIndicator color={colors.sageBright} />
                ) : selected ? (
                  <Text style={styles.check}>Selected</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {isDevAuth ? (
          <>
            <Text style={styles.section}>Developer</Text>
            <Text style={styles.hint}>
              Dev auth mode (no Supabase). Demo PIN unlocks offline when the API
              tunnel is down.
            </Text>
          </>
        ) : null}

        <Pressable style={styles.signOut} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.ink },
    content: { padding: 20, paddingBottom: 40 },
    back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    backText: { color: c.mistMuted, fontFamily: "DMSans_400Regular", fontSize: 14 },
    title: {
      color: c.mist,
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 32,
    },
    email: {
      marginTop: 6,
      color: c.mistMuted,
      fontFamily: "DMSans_400Regular",
    },
    section: {
      marginTop: 28,
      marginBottom: 8,
      color: c.sageBright,
      fontFamily: "DMSans_500Medium",
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    body: {
      color: c.mist,
      fontFamily: "DMSans_400Regular",
      fontSize: 15,
    },
    hint: {
      color: c.mistMuted,
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      marginBottom: 10,
    },
    list: { gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.inkCard,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: c.line,
    },
    rowSelected: {
      borderColor: c.sage,
    },
    rowText: {
      color: c.mist,
      fontFamily: "DMSans_500Medium",
      fontSize: 15,
    },
    check: {
      color: c.sageBright,
      fontFamily: "DMSans_500Medium",
      fontSize: 12,
    },
    signOut: {
      marginTop: 36,
      alignItems: "center",
      paddingVertical: 14,
    },
    signOutText: {
      color: c.danger,
      fontFamily: "DMSans_500Medium",
      fontSize: 15,
    },
  });
}
