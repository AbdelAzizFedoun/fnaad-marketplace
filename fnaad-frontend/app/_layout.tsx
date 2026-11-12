import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import { ThemeProvider } from "../context/ThemeContext";
import { NetworkProvider } from "../context/NetworkContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

function AppContent() {
  const { loggedIn } = useAuth();
  usePushNotifications(loggedIn);

  return <Stack screenOptions={{ headerShown: false }} />;
}

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