import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { useTheme } from "../context/ThemeContext";
import { formatMoney } from "../lib/currency";
import type { ThemeColors } from "../theme/colors";

export function LedgerScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const { sales, expenses, loading } = useBusiness();
  const currency = profile?.preferred_currency ?? "NGN";
  const rows = [
    ...sales.map((s) => ({
      kind: "sale" as const,
      id: s.id,
      title: s.item_or_service || "Sale",
      amount: s.amount,
      method: s.payment_method,
      at: s.sold_at,
    })),
    ...expenses.map((e) => ({
      kind: "expense" as const,
      id: e.id,
      title: e.category || "Expense",
      amount: e.amount,
      method: e.payment_method,
      at: e.incurred_at,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Business ledger</Text>
        <Text style={styles.sub}>Sales in green, expenses in red</Text>
        {loading && !rows.length ? (
          <ActivityIndicator color={colors.sage} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.sub}>No entries yet.</Text>
        ) : (
          rows.map((row) => (
            <View key={`${row.kind}-${row.id}`} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowMeta}>
                  {row.kind === "sale" ? "Sale" : "Expense"} · {row.method}
                </Text>
              </View>
              <Text
                style={[
                  styles.amt,
                  { color: row.kind === "sale" ? colors.income : colors.danger },
                ]}
              >
                {row.kind === "sale" ? "+" : "-"}
                {formatMoney(row.amount, currency)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.ink },
    content: { padding: 20, paddingBottom: 40, gap: 10 },
    back: { flexDirection: "row", alignItems: "center", gap: 6 },
    backText: { color: c.mistMuted, fontFamily: "DMSans_400Regular", fontSize: 14 },
    title: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 32 },
    sub: { color: c.mistMuted, fontFamily: "DMSans_400Regular" },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: c.inkCard,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.line,
    },
    rowTitle: { color: c.mist, fontFamily: "DMSans_500Medium" },
    rowMeta: { color: c.mistMuted, fontSize: 12, marginTop: 2 },
    amt: { fontFamily: "DMSans_700Bold" },
  });
}
