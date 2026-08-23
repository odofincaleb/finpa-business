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
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { ChatInputBar } from "../components/ChatInputBar";
import { useBusiness } from "../context/BusinessContext";
import { useTheme } from "../context/ThemeContext";
import { parseBusinessQuickEntry } from "../lib/parseBusiness";
import type { PaymentMethod } from "../types";
import type { ThemeColors } from "../theme/colors";

const METHODS: PaymentMethod[] = ["cash", "pos", "transfer"];
const FALLBACK_CATS = [
  "Rent",
  "Utilities",
  "Salaries",
  "Inventory",
  "Transport",
  "Marketing",
  "Repairs",
  "Food & Drinks",
  "Miscellaneous",
];

export function AddExpenseScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { addExpense, categories } = useBusiness();
  const names = categories.length ? categories.map((c) => c.name) : FALLBACK_CATS;
  const [category, setCategory] = useState(names[0] ?? "Miscellaneous");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);

  const applyChat = (message: string) => {
    const parsed = parseBusinessQuickEntry(message);
    if (!parsed) {
      Alert.alert("Could not parse", "Try: Paid rent ₦250,000");
      return;
    }
    if (parsed.kind === "expense") {
      setAmount(String(parsed.amount));
      setCategory(parsed.category);
      setMethod(parsed.payment_method === "credit" ? "cash" : parsed.payment_method);
      setNote(parsed.notes);
    } else {
      setAmount(String(parsed.amount));
    }
  };

  const submit = async () => {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Amount required");
      return;
    }
    setBusy(true);
    try {
      await addExpense({
        amount: value,
        category,
        payment_method: method,
        notes: note.trim() || null,
      });
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Record expense</Text>
        <ChatInputBar embedded onSend={applyChat} disabledHint="Paid rent ₦250,000" />
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor={colors.mistMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <View style={styles.methods}>
          {names.map((name) => (
            <Pressable
              key={name}
              onPress={() => setCategory(name)}
              style={[styles.chip, category === name && styles.chipOn]}
            >
              <Text style={[styles.chipText, category === name && styles.chipTextOn]}>{name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.methods}>
          {METHODS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMethod(m)}
              style={[styles.chip, method === m && styles.chipOn]}
            >
              <Text style={[styles.chipText, method === m && styles.chipTextOn]}>{m.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor={colors.mistMuted}
          value={note}
          onChangeText={setNote}
        />
        <Pressable style={styles.save} onPress={() => void submit()} disabled={busy}>
          <Text style={styles.saveText}>{busy ? "Saving…" : "Save expense"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.ink },
    content: { padding: 20, gap: 12, paddingBottom: 40 },
    back: { flexDirection: "row", alignItems: "center", gap: 6 },
    backText: { color: c.mistMuted, fontFamily: "DMSans_400Regular" },
    title: { color: c.mist, fontFamily: "Fraunces_600SemiBold", fontSize: 32 },
    input: {
      backgroundColor: c.inkCard,
      color: c.mist,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.line,
      fontFamily: "DMSans_400Regular",
    },
    methods: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.line,
    },
    chipOn: { backgroundColor: c.chipActiveBg, borderColor: c.sage },
    chipText: { color: c.mistMuted, fontFamily: "DMSans_500Medium" },
    chipTextOn: { color: c.mist },
    save: { backgroundColor: c.teal, borderRadius: 14, padding: 16, alignItems: "center" },
    saveText: { color: "#fff", fontFamily: "DMSans_700Bold" },
  });
}
