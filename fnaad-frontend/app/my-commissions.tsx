import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getMyCommissionRequests, updateCommissionStatus, startCommissionConversation } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { shadow, RADIUS } from "../components/shadow";
import React from "react";

type Response = {
  id: number;
  artist_brand_name: string;
  artist_phone: string;
  artist_is_verified: boolean;
  message: string;
  proposed_price_xaf: number | null;
};

type Commission = {
  id: number;
  title: string;
  description: string;
  category_display: string;
  budget_xaf: number | null;
  status: string;
  response_count: number;
  responses: Response[];
  created_at: string;
};

const STATUS_LABELS_KEYS: Record<string, string> = {
  open: "commission_open",
  in_progress: "commission_in_progress",
  completed: "commission_completed",
  cancelled: "commission_cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#C9A24B",
  in_progress: "#1B4DA6",
  completed: "#5FA779",
  cancelled: "#B0524F",
};

export default function MyCommissionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    getMyCommissionRequests()
      .then((res) => setCommissions(res.data))
      .catch((err) => console.log("My commissions error:", err.message))
      .finally(() => setLoading(false));
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    getMyCommissionRequests()
      .then((res) => setCommissions(res.data))
      .catch((err) => console.log("My commissions error:", err.message))
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handleContactArtist = async (responseId: number) => {
    try {
      const res = await startCommissionConversation(responseId);
      router.push(`/conversation/${res.data.id}`);
    } catch (err: any) {
      console.log("Start conversation error:", err.response?.data || err.message);
      Alert.alert(t("genericErrorTitle"), t("chatStartError"));
    }
  };

  const handleMarkStatus = (id: number, status: "in_progress" | "completed" | "cancelled") => {
    updateCommissionStatus(id, status)
      .then(() => load())
      .catch(() => Alert.alert(t("genericErrorTitle"), t("genericError")));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("myCommissionsTitle")}
        rightElement={
          <Pressable onPress={() => router.push("/request-commission")} accessibilityRole="button" accessibilityLabel="New request">
            <View style={styles.addButton}>
              <Ionicons name="add" size={22} color={colors.accentText} />
            </View>
          </Pressable>
        }
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={commissions}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingTop: 10 }}
          refreshing={refreshing}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
              <Text style={styles.empty}>{t("noCommissions")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || colors.accent) + "20" }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] || colors.accent }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || colors.accent }]}>
                    {t(STATUS_LABELS_KEYS[item.status] || item.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardCategory}>{item.category_display}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
              {item.budget_xaf && <Text style={styles.cardBudget}>{t("budgetLabel")} {item.budget_xaf} XAF</Text>}

              <Text style={styles.responsesTitle}>
                {item.response_count} {item.response_count !== 1 ? t("responsesPlural") : t("response")} {t("responsesSoFar")}
              </Text>

              {item.responses.map((r) => (
                <View key={r.id} style={styles.responseCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.responseArtist}>
                      {r.artist_brand_name}
                    </Text>
                    {r.artist_is_verified && <Ionicons name="checkmark-circle" size={14} color="#5FA779" />}
                  </View>
                  <Text style={styles.responseMessage}>{r.message}</Text>
                  {r.proposed_price_xaf && (
                    <Text style={styles.responsePrice}>{t("proposedPrice")} {r.proposed_price_xaf} XAF</Text>
                  )}
                  <Pressable
                    style={styles.contactBtn}
                    onPress={() => handleContactArtist(r.id)}
                  >
                    <Text style={styles.contactBtnText}>{t("contactMessage")}</Text>
                  </Pressable>
                </View>
              ))}

              {item.status === "open" && (
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => handleMarkStatus(item.id, "cancelled")}
                >
                  <Text style={styles.cancelBtnText}>{t("cancelThisRequest")}</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40 },
    empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 14, fontWeight: "500" },
    card: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 14,
      padding: 16, marginBottom: 14, backgroundColor: colors.surface, ...shadow(2),
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1, lineHeight: 22 },
    statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 5 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
    cardCategory: { color: colors.accent, fontSize: 10, marginTop: 4, textTransform: "uppercase", fontWeight: "700" },
    cardDescription: { color: colors.textMuted, fontSize: 13, marginTop: 8, lineHeight: 19 },
    cardBudget: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: "500" },
    responsesTitle: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 8 },
    responseCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 12, marginBottom: 8, backgroundColor: colors.background,
    },
    responseArtist: { color: colors.text, fontSize: 14, fontWeight: "700" },
    responseMessage: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 19 },
    responsePrice: { color: colors.accent, fontSize: 13, marginTop: 6, fontWeight: "700" },
    contactBtn: {
      backgroundColor: colors.accent, borderRadius: 8, padding: 10,
      alignItems: "center", marginTop: 10,
    },
    contactBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 12 },
    cancelBtn: { marginTop: 12, alignItems: "center" },
    cancelBtnText: { color: "#B0524F", fontSize: 12, fontWeight: "700" },
  });
}
