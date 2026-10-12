import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";
import SubscriptionCountdown from "../../components/SubscriptionCountdown";
import SubscriptionPaymentCard from "../../components/SubscriptionPaymentCard";
import React from "react";

function MenuRow({ icon, label, onPress, colors }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; colors: any }) {
  return (
    <Pressable style={[styles.row, { borderColor: colors.border }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.accent} style={{ marginRight: 12 }} />
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ArtistHubScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { topPadding } = useResponsiveLayout();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [subscriptionRefreshKey, setSubscriptionRefreshKey] = useState(0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: topPadding }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.accent }]}>{t("artistSpace") || "Artist"}</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Ionicons name="person-circle-outline" size={30} color={colors.accent} />
        </Pressable>
      </View>

      <SubscriptionCountdown refreshKey={subscriptionRefreshKey} renewalSuccess={paymentSuccess} />
      {!paymentSuccess && (
        <SubscriptionPaymentCard onSuccess={() => {
          setSubscriptionRefreshKey((current) => current + 1);
          setPaymentSuccess(true);
        }} />
      )}
      {paymentSuccess && (
        <View style={[{ backgroundColor: colors.surface, borderColor: colors.border }, styles.successContainer]}>
          <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
          <Text style={[{ color: colors.accent }, styles.successTitle]}>{t("subscriptionSuccessTitle") || "Subscription successful!"}</Text>
          <Text style={[{ color: colors.text }, styles.successMessage]}>{t("subscriptionSuccessMessage") || "Your subscription has been done successfully."}</Text>
          <Pressable style={[{ backgroundColor: colors.accent }, styles.successButton]} onPress={() => setPaymentSuccess(false)}>
            <Text style={[{ color: colors.background }, styles.successButtonText]}>{t("subscriptionMakeAnother") || "Make another payment"}</Text>
          </Pressable>
        </View>
      )}

      <MenuRow icon="add-circle-outline" label={t("addProduct")} onPress={() => router.push("/add-product")} colors={colors} />
      <MenuRow icon="images-outline" label={t("myProducts")} onPress={() => router.push("/my-products")} colors={colors} />
      <MenuRow icon="bar-chart-outline" label={t("myAnalytics")} onPress={() => router.push("/artist-analytics")} colors={colors} />
      <MenuRow icon="clipboard-outline" label={t("openRequests")} onPress={() => router.push("/browse-commissions")} colors={colors} />
      <MenuRow icon="brush-outline" label={t("editProfile")} onPress={() => router.push("/edit-artist-profile")} colors={colors} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700" },
  row: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10,
    padding: 14, marginBottom: 10,
  },
  rowLabel: { fontSize: 14, fontWeight: "600", flex: 1 },
  successContainer: {
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  successButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  successButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
