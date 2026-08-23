import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fetchDashboard } from "../lib/api";
import { formatMoney } from "../lib/currency";
import type { DashboardSummary } from "../types";
import type { ThemeColors } from "../theme/colors";

const empty: DashboardSummary = {
  todaySales: 0,
  todayExpenses: 0,
  estimatedProfit: 0,
  salesCount: 0,
  openDebtors: 0,
  recentTransactions: [],
};

export function SummaryScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token, profile } = useAuth();
  const currency = profile?.preferred_currency ?? "NGN";
  const [month, setMonth] = useState<DashboardSummary>(empty);

  useEffect(() => {
    if (!token) return;
    void fetchDashboard(token, "monthly").then(setMonth).catch(() => undefined);
  }, [token]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>This month</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Sales</Text>
          <Text style={styles.value}>{formatMoney(month.todaySales, currency)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Expenses</Text>
          <Text style={[styles.value, { color: colors.danger }]}>
            {formatMoney(month.todayExpenses, currency)}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Estimated profit</Text>
          <Text
            style={[
              styles.value,
              { color: month.estimatedProfit >= 0 ? colors.income : colors.danger },
            ]}
          >
            {formatMoney(month.estimatedProfit, currency)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.ink },
    content: { padding: 20, gap: 12 },
    back: { flexDirection: "row", alignItems: "center", gap: 6 },
    backText: { color: c.mistMuted },
    title: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 32 },
    card: {
      backgroundColor: c.inkCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.line,
    },
    label: { color: c.mistMuted, fontFamily: "DMSans_500Medium" },
    value: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 28, marginTop: 6 },
  });
}
