import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { getAdminSubscriptions, activateSubscription, resolveMediaUrl } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Subscription = {
  id: number;
  artist_brand_name: string;
  artist_username: string;
  artist_phone: string;
  artist_region: string;
  artist_mobile_money_number: string;
  artist_mobile_money_provider: string;
  status: string;
  trial_start_date: string;
  trial_end_date: string;
  current_period_end: string | null;
  monthly_price_xaf: number;
  is_active: boolean;
  effective_end_date: string;
};

type PlanOption = { label: string; value: number };

export default function AdminSubscriptionsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Record<number, number>>({});

  const planOptions: PlanOption[] = [
    { label: "1 month", value: 1 },
    { label: "2 months", value: 2 },
    { label: "3 months", value: 3 },
  ];

  const load = () => {
    setLoading(true);
    getAdminSubscriptions()
      .then((res: any) => setSubscriptions(res.data))
      .catch((err: any) => console.log("Admin subscriptions error:", err.response?.data || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleActivate = async (subscription: Subscription) => {
    const days = selectedPlan[subscription.id] || 30;
    setActivatingId(subscription.id);
    try {
      const res = await activateSubscription(subscription.id, { action: "activate", days });
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subscription.id ? { ...s, ...res.data } : s))
      );
    } catch (err: any) {
      console.log("Activate error:", err.response?.data || err.message);
      Alert.alert("Error", err?.response?.data?.detail || "Could not activate subscription.");
    } finally {
      setActivatingId(null);
    }
  };

  const handleCancel = async (subscription: Subscription) => {
    setActivatingId(subscription.id);
    try {
      const res = await activateSubscription(subscription.id, { action: "cancel" });
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subscription.id ? { ...s, ...res.data } : s))
      );
    } catch (err: any) {
      console.log("Cancel error:", err.response?.data || err.message);
      Alert.alert("Error", err?.response?.data?.detail || "Could not cancel subscription.");
    } finally {
      setActivatingId(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#5FA779";
      case "trial":
        return colors.accent;
      case "expired":
        return "#B0524F";
      case "cancelled":
        return colors.textMuted;
      default:
        return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("subscriptionsTitle") || "Subscriptions"} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("subscriptionsTitle") || "Subscriptions"} />
      <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>{t("noSubscriptionsYet") || "No subscriptions yet."}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.is_active && styles.cardInactive]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.artist_brand_name}</Text>
                <Text style={styles.cardMeta}>@{item.artist_username} · {item.artist_region}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subscription</Text>
              <Text style={styles.cardMeta}>Price: {item.monthly_price_xaf.toLocaleString()} XAF/month</Text>
              <Text style={styles.cardMeta}>Trial ends: {new Date(item.trial_end_date).toLocaleDateString()}</Text>
              {item.current_period_end ? (
                <Text style={styles.cardMeta}>Active until: {new Date(item.current_period_end).toLocaleDateString()}</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <Text style={styles.cardMeta}>{item.artist_mobile_money_provider} ({item.artist_mobile_money_number})</Text>
              <Text style={styles.cardMeta}>{item.artist_phone}</Text>
            </View>

            {item.status !== "cancelled" && (
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.activateBtn}
                  onPress={() => handleActivate(item)}
                  disabled={activatingId === item.id}
                >
                  <Text style={styles.btnText}>
                    {activatingId === item.id ? "..." : "Activate"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => handleCancel(item)}
                  disabled={activatingId === item.id}
                >
                  <Text style={styles.btnText}>
                    {activatingId === item.id ? "..." : "Cancel"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    card: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 14, marginBottom: 12,
    },
    cardInactive: { borderColor: "#B0524F" },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    cardName: { color: colors.text, fontSize: 15, fontWeight: "600" },
    cardMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    section: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
    sectionTitle: { color: colors.text, fontSize: 12, fontWeight: "700", marginBottom: 4, textTransform: "uppercase" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
    actionRow: { flexDirection: "row", marginTop: 12, gap: 10 },
    activateBtn: { backgroundColor: "#5FA779", borderRadius: 8, padding: 10, flex: 1, alignItems: "center" },
    cancelBtn: { backgroundColor: "#B0524F", borderRadius: 8, padding: 10, flex: 1, alignItems: "center" },
    btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
    empty: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 30 },
  });
}
