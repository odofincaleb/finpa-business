import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BookOpen, Lightbulb, Settings, Users } from "lucide-react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { useTheme } from "../context/ThemeContext";
import { formatMoney } from "../lib/currency";
import type { ThemeColors } from "../theme/colors";
import type { RootStackParamList } from "../navigation/types";

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const { dashboard, weekly, debtors, syncStatusLine, flushSyncQueue, business } = useBusiness();
  const currency = profile?.preferred_currency ?? "NGN";
  const openDebtors = debtors.filter((d) => d.status !== "paid");
  const profitColor = dashboard.estimatedProfit >= 0 ? colors.income : colors.danger;
  const trend =
    weekly.todaySales > 0
      ? Math.round(((dashboard.todaySales - weekly.todaySales / 7) / (weekly.todaySales / 7 || 1)) * 100)
      : 0;

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
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.biz}>{business?.business_name || "Your business"}</Text>
          {syncStatusLine ? (
            <Pressable onPress={() => void flushSyncQueue()}>
              <Text style={styles.sync}>{syncStatusLine}</Text>
            </Pressable>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Today&apos;s sales</Text>
            <Text style={styles.hero}>{formatMoney(dashboard.todaySales, currency)}</Text>
            <Text style={styles.meta}>
              {dashboard.salesCount} sale{dashboard.salesCount === 1 ? "" : "s"}
              {trend ? ` · ${trend > 0 ? "+" : ""}${trend}% vs daily avg` : ""}
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
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.primary} onPress={() => navigation.navigate("AddSale")}>
              <Text style={styles.primaryText}>Record sale</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => navigation.navigate("AddExpense")}>
              <Text style={styles.secondaryText}>Record expense</Text>
            </Pressable>
          </View>

          {openDebtors.length > 0 ? (
            <Pressable style={styles.alert} onPress={() => navigation.navigate("Debtors")}>
              <Text style={styles.alertText}>
                {openDebtors.length} open debtor{openDebtors.length === 1 ? "" : "s"} — tap to collect
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.section}>Recent</Text>
          {dashboard.recentTransactions.length === 0 ? (
            <Text style={styles.empty}>No sales or expenses yet. Record your first one.</Text>
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
    actions: { flexDirection: "row", gap: 10, marginTop: 4 },
    primary: {
      flex: 1,
      backgroundColor: c.teal,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryText: { color: "#fff", fontFamily: "DMSans_700Bold" },
    secondary: {
      flex: 1,
      backgroundColor: c.inkCard,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.line,
    },
    secondaryText: { color: c.mist, fontFamily: "DMSans_700Bold" },
    alert: {
      backgroundColor: c.warnBg,
      borderColor: c.warnBorder,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
    },
    alertText: { color: c.mist, fontFamily: "DMSans_500Medium" },
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
