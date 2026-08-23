import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { useTheme } from "../context/ThemeContext";
import { fetchDebtorDetail } from "../lib/api";
import { formatMoney } from "../lib/currency";
import type { Debtor, DebtorPayment } from "../types";
import type { RootStackParamList } from "../navigation/types";
import type { ThemeColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "DebtorDetail">;

export function DebtorDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { token, profile } = useAuth();
  const { recordDebtorPayment, markDebtorPaid, debtors } = useBusiness();
  const currency = profile?.preferred_currency ?? "NGN";
  const [debtor, setDebtor] = useState<Debtor | undefined>(
    debtors.find((d) => d.id === route.params.id),
  );
  const [payments, setPayments] = useState<DebtorPayment[]>([]);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!token) return;
    void fetchDebtorDetail(token, route.params.id).then((res) => {
      setDebtor(res.debtor);
      setPayments(res.payments);
    });
  }, [token, route.params.id]);

  if (!debtor) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.meta}>Debtor not found</Text>
      </SafeAreaView>
    );
  }

  const pay = async () => {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Enter a payment amount");
      return;
    }
    await recordDebtorPayment(debtor.id, value);
    setAmount("");
    if (token) {
      const res = await fetchDebtorDetail(token, debtor.id);
      setDebtor(res.debtor);
      setPayments(res.payments);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{debtor.customer_name}</Text>
        <Text style={styles.meta}>{debtor.phone || "No phone"}</Text>
        <Text style={styles.meta}>
          Total {formatMoney(debtor.total_amount, currency)} · paid{" "}
          {formatMoney(debtor.amount_paid, currency)} · balance{" "}
          {formatMoney(debtor.balance, currency)}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Payment amount"
          placeholderTextColor={colors.mistMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <Pressable style={styles.save} onPress={() => void pay()}>
          <Text style={styles.saveText}>Add payment</Text>
        </Pressable>
        {debtor.status !== "paid" ? (
          <Pressable
            style={styles.secondary}
            onPress={() => void markDebtorPaid(debtor).then(() => navigation.goBack())}
          >
            <Text style={styles.secondaryText}>Mark as paid</Text>
          </Pressable>
        ) : null}
        <Text style={styles.section}>Payment history</Text>
        {payments.length === 0 ? (
          <Text style={styles.meta}>No payments yet</Text>
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.row}>
              <Text style={styles.rowTitle}>{formatMoney(p.amount_paid, currency)}</Text>
              <Text style={styles.meta}>{new Date(p.paid_at).toLocaleString()}</Text>
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
    content: { padding: 20, gap: 10, paddingBottom: 40 },
    back: { flexDirection: "row", alignItems: "center", gap: 6 },
    backText: { color: c.mistMuted },
    title: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 32 },
    meta: { color: c.mistMuted },
    input: {
      backgroundColor: c.inkCard,
      color: c.mist,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.line,
    },
    save: { backgroundColor: c.teal, borderRadius: 14, padding: 14, alignItems: "center" },
    saveText: { color: "#fff", fontFamily: "DMSans_700Bold" },
    secondary: {
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.line,
    },
    secondaryText: { color: c.mist, fontFamily: "DMSans_700Bold" },
    section: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 22, marginTop: 8 },
    row: {
      backgroundColor: c.inkCard,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.line,
    },
    rowTitle: { color: c.mist, fontFamily: "DMSans_700Bold" },
  });
}
