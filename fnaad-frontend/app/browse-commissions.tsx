import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, TextInput, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { getOpenCommissionRequests, respondToCommission, unwrapList } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { shadow, RADIUS } from "../components/shadow";
import React from "react";

type Commission = {
  id: number;
  customer_username: string;
  title: string;
  description: string;
  category_display: string;
  budget_xaf: number | null;
  region_display: string | null;
  response_count: number;
  created_at: string;
};

export default function BrowseCommissionsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    getOpenCommissionRequests()
      .then((res) => setCommissions(unwrapList(res.data)))
      .catch((err) => console.log("Browse commissions error:", err.message))
      .finally(() => setLoading(false));
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    getOpenCommissionRequests()
      .then((res) => setCommissions(unwrapList(res.data)))
      .catch((err) => console.log("Browse commissions error:", err.message))
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handleSubmitResponse = async (commissionId: number) => {
    if (!message.trim()) {
      Alert.alert(t("genericErrorTitle"), t("pleaseWriteMessage"));
      return;
    }
    setSubmitting(true);
    try {
      await respondToCommission({
        commission: commissionId,
        message: message.trim(),
        proposed_price_xaf: price ? parseInt(price, 10) : undefined,
      });
      setRespondingTo(null);
      setMessage("");
      setPrice("");
      Alert.alert(t("sentTitle"), t("responseSentToClient"));
      load();
    } catch (err: any) {
      console.log("Respond error:", err.response?.data || err.message);
      Alert.alert(t("genericErrorTitle"), err.response?.data?.non_field_errors?.[0] || t("sendResponseError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("openCommissionsTitle")} />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={commissions}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingTop: 10 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshing={refreshing}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
              <Text style={styles.empty}>{t("noOpenCommissions")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.statusPill, { backgroundColor: colors.accent + "20" }]}>
                  <Text style={[styles.cardCategory, { color: colors.accent }]}>{item.category_display}</Text>
                </View>
              </View>
              <Text style={styles.cardDescription}>{item.description}</Text>
              <View style={styles.metaRow}>
                {item.budget_xaf && <Text style={styles.metaText}>{t("budgetLabel")} {item.budget_xaf} XAF</Text>}
                {item.region_display && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="location" size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>{item.region_display}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.responseCount}>
                {item.response_count} {item.response_count !== 1 ? t("responsesPlural") : t("response")} {t("responsesSoFar")}
              </Text>

              {respondingTo === item.id ? (
                <View style={styles.responseForm}>
                  <TextInput
                    style={[styles.field, styles.textArea]}
                    placeholder={t("yourMessageToCustomer")}
                    placeholderTextColor={colors.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                  />
                  <TextInput
                    style={styles.field}
                    placeholder={t("proposedPricePlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                  />
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <Pressable
                      style={[styles.submitBtn, { flex: 1 }]}
                      onPress={() => handleSubmitResponse(item.id)}
                      disabled={submitting}
                    >
                      <Text style={styles.submitBtnText}>{submitting ? "..." : t("send")}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.cancelBtn, { flex: 1 }]}
                      onPress={() => setRespondingTo(null)}
                    >
                      <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.respondBtn} onPress={() => setRespondingTo(item.id)}>
                  <Text style={styles.respondBtnText}>{t("respondToRequest")}</Text>
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
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40 },
    empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 14, fontWeight: "500" },
    card: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 14,
      padding: 16, marginBottom: 14, backgroundColor: colors.surface, ...shadow(2),
    },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1, lineHeight: 22 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    cardCategory: { fontSize: 10, marginTop: 2, textTransform: "uppercase", fontWeight: "700" },
    cardDescription: { color: colors.textMuted, fontSize: 13, marginTop: 10, lineHeight: 19 },
    metaRow: { flexDirection: "row", gap: 14, marginTop: 10, flexWrap: "wrap" },
    metaText: { color: colors.textMuted, fontSize: 12, fontWeight: "500" },
    responseCount: { color: colors.textMuted, fontSize: 11, marginTop: 8, fontStyle: "italic" },
    respondBtn: {
      backgroundColor: colors.accent, borderRadius: 10, padding: 12,
      alignItems: "center", marginTop: 14, ...shadow(2),
    },
    respondBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    responseForm: { marginTop: 14 },
    field: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12,
      color: colors.text, fontSize: 13, marginBottom: 10, backgroundColor: colors.background,
    },
    textArea: { minHeight: 80, textAlignVertical: "top" },
    submitBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 12, alignItems: "center" },
    submitBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    cancelBtn: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: "center",
    },
    cancelBtnText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  });
}
