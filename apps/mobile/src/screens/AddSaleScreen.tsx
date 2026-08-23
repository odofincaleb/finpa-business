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

const METHODS: PaymentMethod[] = ["cash", "pos", "transfer", "credit"];

export function AddSaleScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { addSale } = useBusiness();
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);

  const applyChat = (message: string) => {
    const parsed = parseBusinessQuickEntry(message);
    if (!parsed || parsed.kind !== "sale") {
      Alert.alert("Could not parse", "Try: Sold 5 shirts ₦75,000 POS");
      return;
    }
    setItem(parsed.item_or_service);
    setAmount(String(parsed.amount));
    setMethod(parsed.payment_method);
  };

  const submit = async () => {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Amount required");
      return;
    }
    setBusy(true);
    try {
      await addSale({
        amount: value,
        item_or_service: item.trim() || "Sale",
        payment_method: method,
        customer_name: customer.trim() || null,
        quantity: Number(quantity) || 1,
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
        <Text style={styles.title}>Record sale</Text>
        <ChatInputBar embedded onSend={applyChat} disabledHint="Sold 5 shirts ₦75,000 POS" />
        <TextInput
          style={styles.input}
          placeholder="Item or service"
          placeholderTextColor={colors.mistMuted}
          value={item}
          onChangeText={setItem}
        />
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor={colors.mistMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Customer name (optional)"
          placeholderTextColor={colors.mistMuted}
          value={customer}
          onChangeText={setCustomer}
        />
        <TextInput
          style={styles.input}
          placeholder="Quantity"
          placeholderTextColor={colors.mistMuted}
          keyboardType="number-pad"
          value={quantity}
          onChangeText={setQuantity}
        />
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
        <Pressable style={styles.save} onPress={() => void submit()} disabled={busy}>
          <Text style={styles.saveText}>{busy ? "Saving…" : "Save sale"}</Text>
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
