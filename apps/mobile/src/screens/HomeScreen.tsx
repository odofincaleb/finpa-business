import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BookOpen, Lightbulb, Settings, Users } from "lucide-react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { BrandMark } from "../components/BrandMark";
import { ChatInputBar } from "../components/ChatInputBar";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { useTheme } from "../context/ThemeContext";
import { useBusinessChat } from "../hooks/useBusinessChat";
import { formatMoney } from "../lib/currency";
import type { Debtor } from "../types";
import type { ThemeColors } from "../theme/colors";
import type { RootStackParamList } from "../navigation/types";

const SALE_AMBER = "#E3B341";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const days = Math.round((due - today) / 86_400_000);
  if (days < 0) {
    const n = Math.abs(days);
    return `overdue ${n} day${n === 1 ? "" : "s"}`;
  }
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

function sortOpenDebtors(debtors: Debtor[]) {
  return [...debtors]
    .filter((d) => d.status !== "paid")
    .sort((a, b) => {
      const aDue = a.due_date ? startOfDay(new Date(a.due_date)) : Number.MAX_SAFE_INTEGER;
      const bDue = b.due_date ? startOfDay(new Date(b.due_date)) : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return b.balance - a.balance;
    });
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const { dashboard, weekly, debtors, syncStatusLine, flushSyncQueue, business } = useBusiness();
  const { send, sending } = useBusinessChat();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const currency = profile?.preferred_currency ?? "NGN";
  const openDebtors = sortOpenDebtors(debtors);
  const openTotal = openDebtors.reduce((sum, d) => sum + d.balance, 0);
  const profitColor = dashboard.estimatedProfit >= 0 ? colors.income : colors.danger;
  const avgProfit = weekly.estimatedProfit / 7;
  const todayProfit = dashboard.estimatedProfit;
  let trendLabel = "";
  if (avgProfit !== 0) {
    const pct = Math.round(((todayProfit - avgProfit) / Math.abs(avgProfit)) * 100);
    if (pct > 0) trendLabel = `🔺 ${pct}% above average`;
    else if (pct < 0) trendLabel = `🔻 ${Math.abs(pct)}% below average`;
  } else if (todayProfit > 0) {
    trendLabel = "🔺 above average";
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const onChat = async (message: string) => {
    const result = await send(message);
    setToast({ ok: result.ok, text: result.summary });
  };

  return (
    <LinearGradient colors={colors.gradient} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style={colors.statusBar} />
        <View style={styles.top}>
          <BrandMark size={44} showWordmark />
          <View style={styles.icons}>
            <Pressable onPress={() => navigation.navigate("QuickTips")} style={styles.iconBtn}>
              <Lightbulb size={20} color={colors.mist} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate("Debtors")} style={styles.iconBtn}>
              <Users size={20} color={colors.mist} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate("Ledger")} style={styles.iconBtn}>
              <BookOpen size={20} color={colors.mist} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate("Settings")} style={styles.iconBtn}>
              <Settings size={20} color={colors.mist} />
            </Pressable>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.biz}>{business?.business_name || "Your business"}</Text>
          {syncStatusLine ? (
            <Pressable onPress={() => void flushSyncQueue()}>
              <Text style={styles.sync}>{syncStatusLine}</Text>
            </Pressable>
          ) : null}

          <ChatInputBar
            embedded
            sending={sending}
            onSend={(message) => void onChat(message)}
          />
          {toast ? (
            <View style={[styles.toast, !toast.ok && styles.toastError]}>
              <Text style={styles.toastText}>{toast.text}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Today&apos;s sales</Text>
            <Text style={styles.hero}>{formatMoney(dashboard.todaySales, currency)}</Text>
            <Text style={styles.meta}>
              {dashboard.salesCount} sale{dashboard.salesCount === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.card, styles.half]}>
              <Text style={styles.label}>Today&apos;s expenses</Text>
              <Text style={[styles.mid, { color: colors.danger }]}>
                {formatMoney(dashboard.todayExpenses, currency)}
              </Text>
            </View>
            <View style={[styles.card, styles.half]}>
              <Text style={styles.label}>Estimated profit</Text>
              <Text style={[styles.mid, { color: profitColor }]}>
                {formatMoney(dashboard.estimatedProfit, currency)}
              </Text>
              {trendLabel ? <Text style={styles.trend}>{trendLabel}</Text> : null}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.primary} onPress={() => navigation.navigate("AddSale")}>
              <Text style={styles.primaryText}>💰 Record Sale</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => navigation.navigate("AddExpense")}>
              <Text style={styles.secondaryText}>📊 Record Expense</Text>
            </Pressable>
          </View>
          <Pressable style={styles.reportsBtn} onPress={() => navigation.navigate("Reports")}>
            <Text style={styles.reportsText}>📊 Reports</Text>
          </Pressable>

          {openDebtors.length > 0 ? (
            <Pressable style={styles.alert} onPress={() => navigation.navigate("Debtors")}>
              <Text style={styles.alertText}>
                ⚠️  {openDebtors.length} open debtor{openDebtors.length === 1 ? "" : "s"} ·{" "}
                {formatMoney(openTotal, currency)} total
              </Text>
              {openDebtors.slice(0, 3).map((d) => {
                const due = dueLabel(d.due_date);
                return (
                  <Text key={d.id} style={styles.alertRow}>
                    {d.customer_name} — {formatMoney(d.balance, currency)}
                    {due ? ` ${due}` : ""}
                  </Text>
                );
              })}
              <Text style={styles.alertLink}>→ Tap to view all</Text>
            </Pressable>
          ) : null}

          <Text style={styles.section}>Recent</Text>
          {dashboard.recentTransactions.length === 0 ? (
            <Text style={styles.empty}>No sales or expenses yet. Try: Sold 5 shirts ₦75k POS</Text>
          ) : (
            dashboard.recentTransactions.map((item) => (
              <View key={`${item.kind}-${item.id}`} style={styles.tx}>
                <View>
                  <Text style={styles.txTitle}>{item.title}</Text>
                  <Text style={styles.txMeta}>
                    {item.kind === "sale" ? "Sale" : "Expense"} · {item.payment_method}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txAmt,
                    { color: item.kind === "sale" ? colors.income : colors.danger },
                  ]}
                >
                  {item.kind === "sale" ? "+" : "-"}
                  {formatMoney(item.amount, currency)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },
    top: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    icons: { flexDirection: "row", gap: 6 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.iconBtnBg,
      alignItems: "center",
      justifyContent: "center",
    },
    content: { padding: 16, paddingBottom: 48, gap: 12 },
    biz: { color: c.mistMuted, fontFamily: "DMSans_500Medium", fontSize: 14 },
    sync: { color: c.sageBright, fontFamily: "DMSans_400Regular", fontSize: 13 },
    toast: {
      backgroundColor: c.warnBg,
      borderColor: c.warnBorder,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    toastError: {
      backgroundColor: c.overBg,
      borderColor: c.overBorder,
    },
    toastText: { color: c.mist, fontFamily: "DMSans_500Medium", fontSize: 13 },
    card: {
      backgroundColor: c.inkCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: c.line,
    },
    row: { flexDirection: "row", gap: 10 },
    half: { flex: 1 },
    label: { color: c.mistMuted, fontFamily: "DMSans_500Medium", fontSize: 13 },
    hero: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 36, marginTop: 4 },
    mid: { fontFamily: "Fraunces_600SemiBold", fontSize: 24, marginTop: 6 },
    meta: { color: c.mistMuted, marginTop: 6, fontFamily: "DMSans_400Regular" },
    trend: { color: c.mistMuted, marginTop: 6, fontFamily: "DMSans_500Medium", fontSize: 12 },
    actions: { flexDirection: "row", gap: 10, marginTop: 4 },
    primary: {
      flex: 1,
      backgroundColor: SALE_AMBER,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    primaryText: { color: "#0B1210", fontFamily: "DMSans_700Bold", fontSize: 15 },
    secondary: {
      flex: 1,
      backgroundColor: c.inkCard,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.line,
    },
    secondaryText: { color: c.mist, fontFamily: "DMSans_700Bold", fontSize: 15 },
    reportsBtn: {
      backgroundColor: c.inkCard,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.line,
    },
    reportsText: { color: c.mist, fontFamily: "DMSans_700Bold", fontSize: 15 },
    alert: {
      backgroundColor: c.warnBg,
      borderColor: c.warnBorder,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      gap: 4,
    },
    alertText: { color: c.mist, fontFamily: "DMSans_700Bold", fontSize: 14 },
    alertRow: { color: c.mist, fontFamily: "DMSans_400Regular", fontSize: 13, marginTop: 2 },
    alertLink: { color: c.sageBright, fontFamily: "DMSans_500Medium", fontSize: 13, marginTop: 6 },
    section: {
      color: c.mist,
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 22,
      marginTop: 8,
    },
    empty: { color: c.mistMuted, fontFamily: "DMSans_400Regular" },
    tx: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.inkCard,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.line,
    },
    txTitle: { color: c.mist, fontFamily: "DMSans_500Medium", fontSize: 15 },
    txMeta: { color: c.mistMuted, fontFamily: "DMSans_400Regular", fontSize: 12, marginTop: 2 },
    txAmt: { fontFamily: "DMSans_700Bold", fontSize: 15 },
  });
}
