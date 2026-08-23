import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  fetchDailyReport,
  fetchExportCsv,
  fetchExportData,
  fetchMonthlyReport,
  fetchWeeklyReport,
} from "../lib/api";
import { formatMoney } from "../lib/currency";
import { shareCsvFile, sharePlainReport } from "../lib/shareReport";
import type { DailyReport, MonthlyReport, ReportRange, WeeklyReport } from "../types";
import type { ThemeColors } from "../theme/colors";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function prettyDate(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekday(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function methodLine(
  byMethod: DailyReport["sales"]["byMethod"],
  currency: string,
) {
  return (["cash", "pos", "transfer"] as const)
    .filter((k) => byMethod[k] > 0)
    .map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${formatMoney(byMethod[k], currency, true)}`)
    .join(" · ");
}

export function ReportsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token, profile } = useAuth();
  const currency = profile?.preferred_currency ?? "NGN";
  const [tab, setTab] = useState<ReportRange>("daily");
  const [date, setDate] = useState(todayYmd());
  const [monthCursor, setMonthCursor] = useState(() => {
    const n = new Date();
    return { year: n.getUTCFullYear(), month: n.getUTCMonth() + 1 };
  });
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"csv" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === "daily") {
        const [d, w] = await Promise.all([fetchDailyReport(token, date), fetchWeeklyReport(token, date)]);
        setDaily(d);
        setWeekly(w);
      } else if (tab === "weekly") {
        setWeekly(await fetchWeeklyReport(token, date));
      } else {
        setMonthly(await fetchMonthlyReport(token, monthCursor.year, monthCursor.month));
      }
    } catch {
      setError("Could not load report. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [token, tab, date, monthCursor.year, monthCursor.month]);

  useEffect(() => {
    void load();
  }, [load]);

  const stamp =
    tab === "monthly"
      ? `${monthCursor.year}-${String(monthCursor.month).padStart(2, "0")}`
      : date;

  const onExport = async () => {
    if (!token) return;
    setBusy("csv");
    try {
      const csv = await fetchExportCsv(
        token,
        tab,
        tab === "monthly" ? undefined : date,
        monthCursor.year,
        monthCursor.month,
      );
      await shareCsvFile(csv, tab, stamp);
    } catch {
      setError("Could not export CSV.");
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    if (!token) return;
    setBusy("share");
    try {
      const pack = await fetchExportData(
        token,
        tab,
        tab === "monthly" ? undefined : date,
        monthCursor.year,
        monthCursor.month,
      );
      await sharePlainReport(pack.shareText);
    } catch {
      setError("Could not share report.");
    } finally {
      setBusy(null);
    }
  };

  const shift = (delta: number) => {
    if (tab === "monthly") {
      const d = new Date(Date.UTC(monthCursor.year, monthCursor.month - 1 + delta, 1));
      setMonthCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    } else {
      setDate(addDays(date, tab === "weekly" ? delta * 7 : delta));
    }
  };

  const trend =
    daily && weekly && weekly.avgDailyProfit
      ? Math.round(((daily.profit - weekly.avgDailyProfit) / Math.abs(weekly.avgDailyProfit)) * 100)
      : 0;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Reports</Text>

        <View style={styles.tabs}>
          {(["daily", "weekly", "monthly"] as const).map((key) => (
            <Pressable
              key={key}
              style={[styles.tab, tab === key && styles.tabOn]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>
                {key[0].toUpperCase() + key.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => shift(-1)} style={styles.shift}>
            <Text style={styles.shiftText}>‹</Text>
          </Pressable>
          <Text style={styles.period}>
            {tab === "daily"
              ? `📅  Today · ${prettyDate(date)}`
              : tab === "weekly" && weekly
                ? `📅  ${prettyDate(weekly.startDate)} – ${prettyDate(weekly.endDate)}`
                : monthly
                  ? `📅  ${monthly.monthName} ${monthly.year}`
                  : "📅"}
          </Text>
          <Pressable onPress={() => shift(1)} style={styles.shift}>
            <Text style={styles.shiftText}>›</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={colors.sageBright} style={{ marginTop: 24 }} />
        ) : tab === "daily" && daily ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>💰 Sales</Text>
              <Text style={styles.hero}>{formatMoney(daily.sales.total, currency)}</Text>
              <Text style={styles.meta}>{methodLine(daily.sales.byMethod, currency) || `${daily.sales.count} sales`}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>📊 Expenses</Text>
              <Text style={[styles.mid, { color: colors.danger }]}>
                {formatMoney(daily.expenses.total, currency)}
              </Text>
              <Text style={styles.meta}>
                {Object.entries(daily.expenses.byCategory)
                  .map(([k, v]) => `${k} ${formatMoney(v, currency, true)}`)
                  .join(" · ") || "No expenses"}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>📈 Profit</Text>
              <Text style={[styles.mid, { color: daily.profit >= 0 ? colors.income : colors.danger }]}>
                {formatMoney(daily.profit, currency)}
              </Text>
              {trend ? (
                <Text style={styles.meta}>
                  {trend > 0 ? `🔺 ${trend}% above avg` : `🔻 ${Math.abs(trend)}% below avg`}
                </Text>
              ) : null}
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>👥 Debtors</Text>
              <Text style={styles.meta}>
                New: {daily.debtors.new} · Collected: {formatMoney(daily.debtors.collected, currency, true)}
              </Text>
              <Text style={styles.body}>
                Open: {daily.debtors.open} ({formatMoney(daily.debtors.openTotal, currency)})
              </Text>
            </View>
          </>
        ) : tab === "weekly" && weekly ? (
          <>
            <View style={styles.card}>
              <Text style={styles.rowLine}>
                Total Sales:     {formatMoney(weekly.totalSales, currency)}
              </Text>
              <Text style={styles.rowLine}>
                Total Expenses:  {formatMoney(weekly.totalExpenses, currency)}
              </Text>
              <Text style={[styles.rowLine, { color: weekly.totalProfit >= 0 ? colors.income : colors.danger }]}>
                Total Profit:    {formatMoney(weekly.totalProfit, currency)}
              </Text>
              <Text style={styles.meta}>Avg Daily: {formatMoney(weekly.avgDailyProfit, currency)}</Text>
            </View>
            <Text style={styles.section}>📊 Day by day</Text>
            {weekly.dailyBreakdown.map((row) => {
              const vsAvg = weekly.avgDailyProfit
                ? row.profit - weekly.avgDailyProfit
                : 0;
              return (
                <View key={row.date} style={styles.day}>
                  <Text style={styles.dayLabel}>{weekday(row.date)}</Text>
                  <Text style={styles.dayNums}>
                    {formatMoney(row.sales, currency, true)}  {formatMoney(row.expenses, currency, true)}  {formatMoney(row.profit, currency, true)}{" "}
                    {vsAvg > 0 ? "🔺" : vsAvg < 0 ? "🔻" : ""}
                  </Text>
                </View>
              );
            })}
          </>
        ) : monthly ? (
          <>
            <View style={styles.card}>
              <Text style={styles.rowLine}>Sales:     {formatMoney(monthly.totalSales, currency)}</Text>
              <Text style={styles.rowLine}>Expenses:  {formatMoney(monthly.totalExpenses, currency)}</Text>
              <Text style={[styles.rowLine, { color: monthly.totalProfit >= 0 ? colors.income : colors.danger }]}>
                Profit:    {formatMoney(monthly.totalProfit, currency)}
              </Text>
              <Text style={styles.meta}>Margin:    {monthly.profitMargin}%</Text>
            </View>
            <Text style={styles.section}>📦 Top expenses</Text>
            {monthly.topExpenseCategories.length === 0 ? (
              <Text style={styles.meta}>No expenses this month</Text>
            ) : (
              monthly.topExpenseCategories.map((c) => (
                <Text key={c.category} style={styles.rowLine}>
                  {c.category}   {formatMoney(c.total, currency, true)} ({c.pct}%)
                </Text>
              ))
            )}
            <Text style={styles.section}>🏆 Top sellers</Text>
            {monthly.topSellingItems.length === 0 ? (
              <Text style={styles.meta}>No sales this month</Text>
            ) : (
              monthly.topSellingItems.map((s) => (
                <Text key={s.item} style={styles.rowLine}>
                  {s.item}  {s.quantity}× = {formatMoney(s.revenue, currency, true)}
                </Text>
              ))
            )}
          </>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={styles.exportBtn} onPress={() => void onExport()} disabled={!!busy}>
            {busy === "csv" ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.exportText}>📤 Export CSV</Text>
            )}
          </Pressable>
          <Pressable style={styles.shareBtn} onPress={() => void onShare()} disabled={!!busy}>
            {busy === "share" ? (
              <ActivityIndicator color={colors.mist} />
            ) : (
              <Text style={styles.shareText}>📤 Share Report</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.ink },
    content: { padding: 20, paddingBottom: 48, gap: 12 },
    back: { flexDirection: "row", alignItems: "center", gap: 6 },
    backText: { color: c.mistMuted },
    title: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 32 },
    tabs: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: c.inkCard,
      borderWidth: 1,
      borderColor: c.line,
    },
    tabOn: { backgroundColor: c.modeActive, borderColor: c.sage },
    tabText: { color: c.mistMuted, fontFamily: "DMSans_500Medium" },
    tabTextOn: { color: c.mist, fontFamily: "DMSans_700Bold" },
    navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    shift: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    shiftText: { color: c.mist, fontSize: 28, lineHeight: 32 },
    period: { color: c.mist, fontFamily: "DMSans_500Medium", flex: 1, textAlign: "center" },
    error: { color: c.danger, fontFamily: "DMSans_400Regular" },
    card: {
      backgroundColor: c.inkCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.line,
      gap: 4,
    },
    label: { color: c.mistMuted, fontFamily: "DMSans_500Medium" },
    hero: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 32 },
    mid: { fontFamily: "Fraunces_600SemiBold", fontSize: 26 },
    meta: { color: c.mistMuted, fontFamily: "DMSans_400Regular", fontSize: 13 },
    body: { color: c.mist, fontFamily: "DMSans_500Medium", fontSize: 15 },
    section: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 20, marginTop: 8 },
    rowLine: { color: c.mist, fontFamily: "DMSans_500Medium", fontSize: 15 },
    day: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: c.inkCard,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.line,
    },
    dayLabel: { color: c.mist, fontFamily: "DMSans_500Medium" },
    dayNums: { color: c.mistMuted, fontFamily: "DMSans_400Regular", fontSize: 13 },
    actions: { flexDirection: "row", gap: 10, marginTop: 8 },
    exportBtn: {
      flex: 1,
      backgroundColor: "#E3B341",
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    exportText: { color: "#0B1210", fontFamily: "DMSans_700Bold" },
    shareBtn: {
      flex: 1,
      backgroundColor: c.inkCard,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.line,
    },
    shareText: { color: c.mist, fontFamily: "DMSans_700Bold" },
  });
}
