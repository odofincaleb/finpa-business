import React, { Component, useMemo, type ErrorInfo, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { BusinessProvider } from "./src/context/BusinessContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { AuthScreen } from "./src/screens/AuthScreen";
import { ActivatePinScreen } from "./src/screens/ActivatePinScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LedgerScreen } from "./src/screens/LedgerScreen";
import { SummaryScreen } from "./src/screens/SummaryScreen";
import { QuickTipsScreen } from "./src/screens/QuickTipsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { AdminPinsScreen } from "./src/screens/AdminPinsScreen";
import { AddSaleScreen } from "./src/screens/AddSaleScreen";
import { AddExpenseScreen } from "./src/screens/AddExpenseScreen";
import { DebtorsScreen } from "./src/screens/DebtorsScreen";
import { DebtorDetailScreen } from "./src/screens/DebtorDetailScreen";
import type { RootStackParamList } from "./src/navigation/types";
import { darkColors } from "./src/theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FINPA Business crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={bootStyles.errorBox}>
          <Text style={bootStyles.errorTitle}>FINPA Business hit an error</Text>
          <Text style={bootStyles.errorBody}>{String(this.state.error.message)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootNavigator() {
  const { loading, token, subscriptionActive, isSuperAdmin } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[bootStyles.center, { backgroundColor: colors.ink }]}>
        <ActivityIndicator color={colors.sageBright} size="large" />
      </View>
    );
  }

  if (!token) return <AuthScreen />;
  if (!subscriptionActive && !isSuperAdmin) return <ActivatePinScreen />;

  return (
    <BusinessProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Ledger" component={LedgerScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
        <Stack.Screen name="QuickTips" component={QuickTipsScreen} />
        <Stack.Screen name="AdminPins" component={AdminPinsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="AddSale" component={AddSaleScreen} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        <Stack.Screen name="Debtors" component={DebtorsScreen} />
        <Stack.Screen name="DebtorDetail" component={DebtorDetailScreen} />
      </Stack.Navigator>
    </BusinessProvider>
  );
}

function ThemedApp() {
  const { colors, isDark } = useTheme();

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.ink,
        card: colors.inkSoft,
        text: colors.mist,
        border: colors.line,
        primary: colors.sageBright,
      },
    }),
    [colors, isDark],
  );

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <NavigationContainer theme={navTheme}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={bootStyles.center}>
        <StatusBar style="light" />
        <ActivityIndicator color={darkColors.sageBright} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const bootStyles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: darkColors.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBox: {
    flex: 1,
    backgroundColor: darkColors.ink,
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    color: darkColors.mist,
    fontSize: 22,
    marginBottom: 12,
    fontWeight: "700",
  },
  errorBody: {
    color: darkColors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
