import { Stack } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { LanguageProvider, useLanguage } from "../context/LanguageContext";
import { ThemeProvider } from "../context/ThemeContext";
import { NetworkProvider, useNetwork } from "../context/NetworkContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useWebIncomingCalls } from "../hooks/useWebIncomingCalls";

function AppContent() {
  const { loggedIn } = useAuth();
  const { isOffline, checkConnection } = useNetwork();
  const { t } = useLanguage();
  usePushNotifications(loggedIn);
  useWebIncomingCalls(loggedIn);

  return <View style={styles.root}>
    <Stack screenOptions={{ headerShown: false }} />
    {isOffline ? <Pressable style={styles.offlineBanner} onPress={() => void checkConnection()} accessibilityRole="button" accessibilityLabel={t("retry")}>
      <Text style={styles.offlineText}>{t("unstableConnection")}</Text>
      <Text style={styles.retryText}>{t("retry")}</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  offlineBanner: { position: "absolute", left: 12, right: 12, bottom: 12, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#7A302D", flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 20, elevation: 8 },
  offlineText: { color: "#FFFFFF", fontSize: 12, flex: 1, marginRight: 10 },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <NetworkProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </NetworkProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
