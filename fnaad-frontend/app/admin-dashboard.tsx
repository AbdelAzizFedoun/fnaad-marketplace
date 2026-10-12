import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { getAdminDashboard, getSubscriptionPlans } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import React from "react";

type DashboardData = {
  products: { total: number; pending: number; approved: number; rejected: number };
  users: { total_artists: number; total_customers: number };
  orders: {
    total_conversations: number;
    negotiating: number;
    confirmed: number;
    delivered: number;
    cancelled: number;
  };
  top_artists: { brand_name: string; product_count: number }[];
  artists_by_region: { region: string | null; region_display: string; count: number }[];
  products_by_category: { category: string; category_display: string; count: number }[];
  subscription_stats: SubscriptionStats;
};

type SubscriptionPlan = {
  id: number;
  duration_months: number;
  price_xaf: number;
};

type SubscriptionStats = {
  total_artists: number;
  trial_count: number;
  active_count: number;
  expired_count: number;
  cancelled_count: number;
};

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [data, setData] = useState<DashboardData | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subStats, setSubStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAdminDashboard(),
      getSubscriptionPlans(),
    ])
      .then(([dashRes, plansRes]) => {
        setData(dashRes.data);
        setSubStats(dashRes.data.subscription_stats);
        setPlans(plansRes.data.plans || []);
      })
      .catch((err) => console.log("Dashboard error:", err.response?.data || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("dashboardTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("dashboardTitle")} />
      <ScrollView contentContainerStyle={styles.content}>
        {!data && (
          <Text style={styles.error}>{t("dashboardLoadError")}</Text>
        )}

        {data && (
          <>
            <Text style={styles.sectionTitle}>{t("artworksSection")}</Text>
            <View style={styles.statsGrid}>
              <StatCard label={t("total")} value={data.products.total} color={colors.text} styles={styles} />
              <StatCard label={t("pending")} value={data.products.pending} color={colors.accent} styles={styles} />
              <StatCard label={t("published")} value={data.products.approved} color="#5FA779" styles={styles} />
              <StatCard label={t("rejected")} value={data.products.rejected} color="#B0524F" styles={styles} />
            </View>

            <Text style={styles.sectionTitle}>{t("usersSection")}</Text>
            <View style={styles.statsGrid}>
              <StatCard label={t("artists")} value={data.users.total_artists} color={colors.text} styles={styles} />
              <StatCard label={t("customers")} value={data.users.total_customers} color={colors.text} styles={styles} />
            </View>

            <Text style={styles.sectionTitle}>{t("ordersSection")}</Text>
            <View style={styles.statsGrid}>
              <StatCard label={t("total")} value={data.orders.total_conversations} color={colors.text} styles={styles} />
              <StatCard label={t("negotiating")} value={data.orders.negotiating} color={colors.accent} styles={styles} />
              <StatCard label={t("confirmed")} value={data.orders.confirmed} color="#4A90D9" styles={styles} />
              <StatCard label={t("delivered")} value={data.orders.delivered} color="#5FA779" styles={styles} />
              <StatCard label={t("cancelled")} value={data.orders.cancelled} color="#B0524F" styles={styles} />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Subscription plans</Text>
        {plans.length === 0 ? (
          <Text style={styles.empty}>No plans configured.</Text>
        ) : (
          <View style={styles.plansGrid}>
            {plans.map((plan) => (
              <View key={plan.id} style={styles.planCard}>
                <Text style={styles.planDuration}>{plan.duration_months} month{plan.duration_months > 1 ? "s" : ""}</Text>
                <Text style={styles.planPrice}>{plan.price_xaf.toLocaleString()} XAF</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Subscription status</Text>
        {!subStats ? (
          <Text style={styles.empty}>Loading subscription stats...</Text>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard label="Trial" value={subStats.trial_count} color={colors.accent} styles={styles} />
            <StatCard label="Active" value={subStats.active_count} color="#5FA779" styles={styles} />
            <StatCard label="Expired" value={subStats.expired_count} color="#B0524F" styles={styles} />
            <StatCard label="Cancelled" value={subStats.cancelled_count} color={colors.textMuted} styles={styles} />
          </View>
        )}

        {data && (
          <>
            <Text style={styles.sectionTitle}>{t("topArtists")}</Text>
            {data.top_artists.length === 0 ? (
              <Text style={styles.empty}>{t("noArtistsYet")}</Text>
            ) : (
              data.top_artists.map((artist, i) => (
                <View key={i} style={styles.artistRow}>
                  <Text style={styles.artistName}>{artist.brand_name}</Text>
                  <Text style={styles.artistCount}>{artist.product_count} {t("artworksCount")}</Text>
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>{t("artistsByRegion")}</Text>
            {data.artists_by_region.length === 0 ? (
              <Text style={styles.empty}>{t("noRegionalData")}</Text>
            ) : (
              data.artists_by_region.map((r, i) => (
                <View key={i} style={styles.artistRow}>
                  <Text style={styles.artistName}>{r.region_display}</Text>
                  <Text style={styles.artistCount}>{r.count} {t("artistsCount")}</Text>
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>{t("artworksByCategory")}</Text>
            {data.products_by_category.length === 0 ? (
              <Text style={styles.empty}>{t("noDataYet")}</Text>
            ) : (
              data.products_by_category.map((c, i) => (
                <View key={i} style={styles.artistRow}>
                  <Text style={styles.artistName}>{c.category_display}</Text>
                  <Text style={styles.artistCount}>{c.count} {t("artworksCount")}</Text>
                </View>
              ))
            )}

            <View style={styles.revenueNote}>
              <Text style={styles.revenueNoteText}>{t("revenueNote")}</Text>
            </View>

            <Pressable style={styles.moderationBtn} onPress={() => router.push("/admin-approve")}>
              <Text style={styles.moderationBtnText}>{t("goToModeration")}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color, styles }: { label: string; value: number; color: string; styles: any }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginTop: 20, marginBottom: 10, textTransform: "uppercase" },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 14, minWidth: "30%", flexGrow: 1, alignItems: "center",
    },
    statValue: { fontSize: 22, fontWeight: "700" },
    statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: "center" },
    plansGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    planCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 14, minWidth: "28%", flexGrow: 1, alignItems: "center",
      backgroundColor: colors.surface,
    },
    planDuration: { color: colors.text, fontSize: 13, fontWeight: "600", marginBottom: 4 },
    planPrice: { color: colors.accent, fontSize: 18, fontWeight: "800" },
    artistRow: {
      flexDirection: "row", justifyContent: "space-between",
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, marginBottom: 8,
    },
    artistName: { color: colors.text, fontSize: 13, fontWeight: "600" },
    artistCount: { color: colors.accent, fontSize: 12 },
    empty: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 10 },
    revenueNote: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, marginTop: 24,
    },
    revenueNoteText: { color: colors.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16 },
    moderationBtn: {
      backgroundColor: colors.accent, borderRadius: 8, padding: 14,
      alignItems: "center", marginTop: 20,
    },
    moderationBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    error: { color: "#E7A0A0", fontSize: 13, textAlign: "center", marginTop: 60 },
  });
}
