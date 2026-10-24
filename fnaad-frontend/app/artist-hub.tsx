import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";
import SubscriptionCountdown from "../components/SubscriptionCountdown";
import SubscriptionPaymentCard from "../components/SubscriptionPaymentCard";
import React from "react";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type MenuItem = {
  icon: IoniconsName;
  labelKey: string;
  route: string;
};

const ITEMS: MenuItem[] = [
  { icon: "add-circle-outline", labelKey: "addProduct", route: "/add-product" },
  { icon: "images-outline", labelKey: "myProducts", route: "/my-products" },
  { icon: "bar-chart-outline", labelKey: "myAnalytics", route: "/artist-analytics" },
  { icon: "star-outline", labelKey: "spotlightApproval", route: "/artist-spotlight" },
  { icon: "clipboard-outline", labelKey: "openRequests", route: "/browse-commissions" },
  { icon: "brush-outline", labelKey: "editProfile", route: "/edit-artist-profile" },
];

export default function ArtistHubScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { topPadding } = useResponsiveLayout();
  const styles = createStyles(colors);
  const [paymentSuccess, setPaymentSuccess] = React.useState(false);
  const [subscriptionRefreshKey, setSubscriptionRefreshKey] = React.useState(0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.title}>{t("artistSpace") || "Artist space"}</Text>

      <SubscriptionCountdown refreshKey={subscriptionRefreshKey} renewalSuccess={paymentSuccess} />
      {!paymentSuccess && (
        <SubscriptionPaymentCard onSuccess={() => {
          setSubscriptionRefreshKey((current) => current + 1);
          setPaymentSuccess(true);
        }} />
      )}
      {paymentSuccess && (
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
          <Text style={styles.successTitle}>{t("subscriptionSuccessTitle") || "Subscription successful!"}</Text>
          <Text style={styles.successMessage}>{t("subscriptionSuccessMessage") || "Your subscription has been done successfully."}</Text>
          <Pressable style={styles.successButton} onPress={() => setPaymentSuccess(false)}>
            <Text style={styles.successButtonText}>{t("subscriptionMakeAnother") || "Make another payment"}</Text>
          </Pressable>
        </View>
      )}

      {ITEMS.map((item) => (
        <Pressable
          key={item.route}
          style={styles.row}
          onPress={() => router.push(item.route as any)}
        >
          <Ionicons name={item.icon} size={20} color={colors.accent} style={{ marginRight: 12 }} />
          <Text style={styles.label}>{t(item.labelKey)}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    title: { color: colors.accent, fontSize: 22, fontWeight: "700", marginBottom: 20, textAlign: "left" },
    row: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 14, marginBottom: 10,
    },
    label: { color: colors.text, fontSize: 14, fontWeight: "500", flex: 1 },
    successContainer: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 24,
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    successTitle: {
      color: colors.accent,
      fontSize: 18,
      fontWeight: "700",
      marginTop: 12,
      textAlign: "center",
    },
    successMessage: {
      color: colors.text,
      fontSize: 14,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 20,
    },
    successButton: {
      marginTop: 16,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    successButtonText: {
      color: colors.background,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
