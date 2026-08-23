import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/colors";

type TipBlock = {
  title: string;
  examples: string[];
  note?: string;
};

const TIPS: TipBlock[] = [
  {
    title: "Record a sale",
    examples: [
      "Sold 5 shirts ₦75,000 POS",
      "Sold bread 2500 cash",
      "Sale ₦12,000 transfer",
    ],
    note: "Amount + what you sold. Add POS, cash, transfer, or credit.",
  },
  {
    title: "Record an expense",
    examples: [
      "Paid rent ₦250,000",
      "Paid transport 3500",
      "Inventory 48000 transfer",
    ],
  },
  {
    title: "Debtors",
    examples: [
      "Add a customer who still owes you, then record partial payments until the balance is zero.",
    ],
  },
];

export function QuickTipsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style={colors.statusBar} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <ArrowLeft size={20} color={colors.mist} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Quick tips</Text>
        <Text style={styles.lead}>
          Short phrases FINPA Business understands when you record a sale or expense.
        </Text>

        {TIPS.map((block) => (
          <View key={block.title} style={styles.block}>
            <Text style={styles.blockTitle}>{block.title}</Text>
            {block.examples.map((ex) => (
              <View key={ex} style={styles.example}>
                <Text style={styles.quote}>“{ex}”</Text>
              </View>
            ))}
            {block.note ? <Text style={styles.note}>{block.note}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.ink },
    content: { padding: 20, paddingBottom: 48 },
    back: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    backText: {
      fontFamily: "DMSans_500Medium",
      color: c.mist,
      fontSize: 15,
    },
    title: {
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 28,
      color: c.mist,
      marginBottom: 8,
    },
    lead: {
      fontFamily: "DMSans_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: c.mistMuted,
      marginBottom: 28,
    },
    block: { marginBottom: 28 },
    blockTitle: {
      fontFamily: "DMSans_700Bold",
      fontSize: 13,
      color: c.sageBright,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    example: {
      backgroundColor: c.inkCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    quote: {
      fontFamily: "DMSans_500Medium",
      fontSize: 14,
      lineHeight: 20,
      color: c.mist,
    },
    note: {
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      lineHeight: 19,
      color: c.mistMuted,
      marginTop: 4,
    },
  });
}
