import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fetchMonthlyReport } from "../lib/api";
import { formatMoney } from "../lib/currency";
import type { MonthlyReport } from "../types";
import type { ThemeColors } from "../theme/colors";
import type { RootStackParamList } from "../navigation/types";

const COGS = new Set(["Inventory", "inventory", "stock", "Stock"]);

export function SummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token, profile } = useAuth();
  const currency = profile?.preferred_currency ?? "NGN";
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const [current, setCurrent] = useState<MonthlyReport | null>(null);
  const [prev, setPrev] = useState<MonthlyReport | null>(null);

  useEffect(() => {
    if (!token) return;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    void Promise.all([
      fetchMonthlyReport(token, year, month),
      fetchMonthlyReport(token, prevYear, prevMonth),
    ])
      .then(([cur, last]) => {
        setCurrent(cur);
        setPrev(last);
      })
      .catch(() => undefined);
  }, [token, year, month]);

  const cogs =
    current?.topExpenseCategories
      .filter((c) => COGS.has(c.category))
      .reduce((a, c) => a + c.total, 0) ?? 0;
  const operating = Math.max(0, (current?.totalExpenses ?? 0) - cogs);
  const mom =
    prev && prev.totalProfit
      ? Math.round((((current?.totalProfit ?? 0) - prev.totalProfit) / Math.abs(prev.totalProfit)) * 100)
      : null;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>FINPA Business — P&amp;L Summary</Text>
        <Text style={styles.title}>{current?.monthName ?? "This month"} {current?.year ?? year}</Text>

        <View style={styles.card}>
          <Row label="Revenue (Sales)" value={formatMoney(current?.totalSales ?? 0, currency)} />
          <Row label="- Cost of Goods" value={formatMoney(cogs, currency)} danger />
          <Row label="- Operating Exp." value={formatMoney(operating, currency)} danger />
          <View style={styles.rule} />
          <Row
            label="Net Profit"
            value={formatMoney(current?.totalProfit ?? 0, currency)}
            strong
            color={(current?.totalProfit ?? 0) >= 0 ? colors.income : colors.danger}
          />
          <Row label="Profit Margin" value={`${current?.profitMargin ?? 0}%`} />
        </View>

        {mom != null ? (
          <Text style={styles.mom}>
            {mom >= 0 ? "📈" : "📉"} vs Last Month: {mom >= 0 ? "+" : ""}
            {mom}%
          </Text>
        ) : (
          <Text style={styles.hint}>Month-over-month appears after you have last month&apos;s sales.</Text>
        )}

        {current?.topExpenseCategories.length ? (
          <>
            <Text style={styles.section}>Expense mix</Text>
            {current.topExpenseCategories.map((c) => (
              <Text key={c.category} style={styles.mix}>
                {c.category}  {formatMoney(c.total, currency, true)} ({c.pct}%)
              </Text>
            ))}
          </>
        ) : null}

        <Pressable style={styles.link} onPress={() => navigation.navigate("Reports")}>
          <Text style={styles.linkText}>Open full reports →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  danger,
  strong,
  color,
}: {
  label: string;
  value: string;
  danger?: boolean;
  strong?: boolean;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text
        style={{
          color: colors.mistMuted,
          fontFamily: strong ? "DMSans_700Bold" : "DMSans_400Regular",
          fontSize: 15,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: color ?? (danger ? colors.danger : colors.mist),
          fontFamily: strong ? "Fraunces_600SemiBold" : "DMSans_500Medium",
          fontSize: strong ? 22 : 15,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.ink },
    content: { padding: 20, gap: 12 },
    back: { flexDirection: "row", alignItems: "center", gap: 6 },
    backText: { color: c.mistMuted },
    kicker: { color: c.sageBright, fontFamily: "DMSans_500Medium", fontSize: 13 },
    title: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 32 },
    card: {
      backgroundColor: c.inkCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.line,
    },
    rule: { height: 1, backgroundColor: c.line, marginVertical: 8 },
    mom: { color: c.mist, fontFamily: "DMSans_500Medium", fontSize: 16 },
    hint: { color: c.mistMuted, fontFamily: "DMSans_400Regular" },
    section: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 22, marginTop: 8 },
    mix: { color: c.mist, fontFamily: "DMSans_400Regular", fontSize: 14 },
    link: { marginTop: 16 },
    linkText: { color: c.sageBright, fontFamily: "DMSans_700Bold" },
  });
}
