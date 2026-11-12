import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../context/NetworkContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

export default function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  const { isOffline, checkConnection } = useNetwork();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [checking, setChecking] = useState(false);

  if (!isOffline) return null;

  const handlePressRetry = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const connected = await checkConnection();
      if (connected && onRetry) {
        onRetry();
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: "#2A241C", borderColor: "#634A1B" }]}>
      <View style={styles.leftRow}>
        <Ionicons name="cloud-offline-outline" size={16} color="#E8B949" style={{ marginRight: 8 }} />
        <Text style={[styles.text, { color: "#F0ECE4" }]} numberOfLines={1}>
          {t("offlineBanner") || "Mode hors ligne · Contenu enregistré"}
        </Text>
      </View>
      <Pressable
        onPress={handlePressRetry}
        style={styles.retryBtn}
        hitSlop={8}
        disabled={checking}
      >
        {checking ? (
          <ActivityIndicator size="small" color="#E8B949" />
        ) : (
          <Text style={[styles.retryText, { color: "#E8B949" }]}>
            {t("retry") || "Réessayer"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    zIndex: 99,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
});
