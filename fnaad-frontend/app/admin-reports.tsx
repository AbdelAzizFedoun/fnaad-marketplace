import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { getReportedConversations } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import React from "react";

type ReportedConversation = {
  id: number;
  product_title: string;
  customer_username: string;
  report_reason: string;
  reported_at: string;
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [reports, setReports] = useState<ReportedConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReportedConversations()
      .then((res) => setReports(res.data))
      .catch((err) => console.log("Reports error:", err.response?.data || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("reportsTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("reportsTitle")} />
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>{t("noReportsYet")}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/conversation/${item.id}`)}>
            <Text style={styles.cardTitle}>{item.product_title}</Text>
            <Text style={styles.cardCustomer}>{t("customerLabel")}: {item.customer_username}</Text>
            <Text style={styles.cardReason}>{item.report_reason}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    card: {
      borderWidth: 1, borderColor: "#B0524F", borderRadius: 10,
      padding: 14, marginBottom: 10,
    },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
    cardCustomer: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
    cardReason: { color: "#E7A0A0", fontSize: 12, marginTop: 8 },
    empty: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 30 },
  });
}
