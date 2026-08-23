import React, { useMemo, useState } from "react";
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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { useTheme } from "../context/ThemeContext";
import { formatMoney } from "../lib/currency";
import type { RootStackParamList } from "../navigation/types";
import type { ThemeColors } from "../theme/colors";

export function DebtorsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const { debtors, addDebtor } = useBusiness();
  const currency = profile?.preferred_currency ?? "NGN";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const submit = async () => {
    const total = Number(amount.replace(/,/g, ""));
    if (!name.trim() || !Number.isFinite(total) || total <= 0) {
      Alert.alert("Name and amount required");
      return;
    }
    await addDebtor({ customer_name: name.trim(), phone: phone.trim(), total_amount: total });
    setName("");
    setPhone("");
    setAmount("");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Debtors</Text>
        <TextInput style={styles.input} placeholder="Customer name" placeholderTextColor={colors.mistMuted} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Phone" placeholderTextColor={colors.mistMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Total amount" placeholderTextColor={colors.mistMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Pressable style={styles.save} onPress={() => void submit()}>
          <Text style={styles.saveText}>Add debtor</Text>
        </Pressable>
        {debtors.map((d) => {
          const overdue = d.due_date ? new Date(d.due_date) < new Date() && d.status !== "paid" : false;
          return (
            <Pressable
              key={d.id}
              style={styles.card}
              onPress={() => navigation.navigate("DebtorDetail", { id: d.id })}
            >
              <Text style={styles.name}>{d.customer_name}</Text>
              <Text style={styles.meta}>{d.phone || "No phone"}</Text>
              <Text style={[styles.bal, overdue && { color: colors.danger }]}>
                Balance {formatMoney(d.balance, currency)} · {d.status}
                {d.due_date ? ` · due ${d.due_date}` : ""}
              </Text>
              <Text style={styles.meta}>
                Total {formatMoney(d.total_amount, currency)} · paid {formatMoney(d.amount_paid, currency)}
              </Text>
            </Pressable>
          );
        })}
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
    card: {
      backgroundColor: c.inkCard,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.line,
    },
    name: { color: c.mist, fontFamily: "DMSans_700Bold", fontSize: 16 },
    meta: { color: c.mistMuted, marginTop: 4 },
    bal: { color: c.sageBright, marginTop: 6, fontFamily: "DMSans_500Medium" },
  });
}
