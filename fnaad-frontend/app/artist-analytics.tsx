import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { getMyArtistAnalytics } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type ProductStat = {
  id: number;
  title: string;
  view_count: number;
  favorite_count: number;
  average_rating: number | null;
  review_count: number;
};

type AnalyticsData = {
  total_views: number;
  total_favorites: number;
  average_rating: number | null;
  review_count: number;
  total_conversations: number;
  response_rate: number | null;
  products: ProductStat[];
};

export default function ArtistAnalyticsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getMyArtistAnalytics()
      .then((res) => setData(res.data))
      .catch((err) => {
        console.log("Analytics error:", err.response?.data || err.message);
        setErrorMsg(t("genericErrorTitle") || "Unable to load analytics.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("myAnalytics") || "My analytics"} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (errorMsg || !data) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("myAnalytics") || "My analytics"} />
        <Text style={styles.error}>{errorMsg || (t("genericErrorTitle") || "Error")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("myAnalytics") || "My analytics"} />
      <ScrollView contentContainerStyle={styles.content}>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{data.total_views}</Text>
          <Text style={styles.summaryLabel}>Vues totales</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{data.total_favorites}</Text>
          <Text style={styles.summaryLabel}>Favoris</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {data.average_rating !== null ? `${data.average_rating} ★` : "—"}
          </Text>
          <Text style={styles.summaryLabel}>{data.review_count} avis</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {data.response_rate !== null ? `${data.response_rate}%` : "—"}
          </Text>
          <Text style={styles.summaryLabel}>Response rate</Text>
        </View>
      </View>

<Text style={styles.sectionTitle}>By artwork</Text>
      {data.products.length === 0 ? (
        <Text style={styles.empty}>No artwork yet.</Text>
      ) : (
        data.products.map((p) => (
          <View key={p.id} style={styles.productCard}>
            <Text style={styles.productTitle}>{p.title}</Text>
            <View style={styles.productStatsRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}><Ionicons name="eye-outline" size={13} color={undefined} /><Text style={styles.productStat}> {p.view_count}</Text></View>
              <Text style={styles.productStat}>♥ {p.favorite_count}</Text>
              <Text style={styles.productStat}>
                {p.average_rating !== null ? `★ ${p.average_rating} (${p.review_count})` : "No reviews"}
              </Text>
            </View>
          </View>
        ))
      )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof import("../context/ThemeContext").useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    error: { color: "#E7A0A0", fontSize: 13, textAlign: "center", marginTop: 60 },
    summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
    summaryCard: {
      width: "47%", borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 16, alignItems: "center",
    },
    summaryValue: { color: colors.accent, fontSize: 22, fontWeight: "700" },
    summaryLabel: { color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: "center" },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 12 },
    empty: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 20 },
    productCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, marginBottom: 8,
    },
    productTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
    productStatsRow: { flexDirection: "row", gap: 14, marginTop: 8 },
    productStat: { color: colors.textMuted, fontSize: 11 },
  });
}
