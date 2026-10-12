import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCustomerProfile } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import ScreenHeader from "../../components/ScreenHeader";
import React from "react";

type Order = {
  id: number;
  product_title: string;
  status: string;
  created_at: string;
};

type CustomerProfile = {
  id: number;
  username: string;
  member_since: string;
  phone_number: string | null;
  orders: Order[];
};

const STATUS_COLORS: Record<string, string> = {
  negotiating: "#C9A24B",
  confirmed: "#4A90D9",
  delivered: "#5FA779",
  cancelled: "#B0524F",
};

export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getCustomerProfile(Number(id))
      .then((res) => setProfile(res.data))
      .catch((err) => {
        console.log("Customer profile error:", err.response?.data || err.message);
        setErrorMsg(t("customerNotFound"));
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("customerProfileTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (errorMsg || !profile) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("customerProfileTitle")} />
        <Text style={styles.error}>{errorMsg || t("customerNotFound")}</Text>
      </View>
    );
  }

  const memberSinceDate = new Date(profile.member_since).toLocaleDateString();

  return (
    <View style={styles.container}>
      <ScreenHeader title={profile.username} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{profile.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.username}>{profile.username}</Text>
          <Text style={styles.memberSince}>{t("memberSince")} {memberSinceDate}</Text>
        </View>

        {profile.phone_number ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>{t("phoneField")}</Text>
            <Text style={styles.infoValue}>{profile.phone_number}</Text>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoHint}>{t("phoneNotAvailable")}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t("orderHistory")}</Text>
        {profile.orders.length === 0 ? (
          <Text style={styles.empty}>{t("noOrdersYet")}</Text>
        ) : (
          profile.orders.map((order) => (
            <Pressable
              key={order.id}
              style={styles.orderCard}
              onPress={() => router.push(`/conversation/${order.id}`)}
            >
              <Text style={styles.orderTitle}>{order.product_title}</Text>
              <View style={styles.orderMetaRow}>
                <Text style={[styles.orderStatus, { color: STATUS_COLORS[order.status] || colors.textMuted }]}>
                  {t(order.status)}
                </Text>
                <Text style={styles.orderDate}>
                  {new Date(order.created_at).toLocaleDateString()}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    error: { color: "#E7A0A0", fontSize: 13, textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
    avatarWrap: { alignItems: "center", marginBottom: 24 },
    avatarPlaceholder: {
      width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.accent,
      backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", marginBottom: 12,
    },
    avatarInitial: { color: colors.accent, fontSize: 28, fontWeight: "700" },
    username: { color: colors.text, fontSize: 18, fontWeight: "700" },
    memberSince: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
    infoBox: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 14, marginBottom: 24,
    },
    infoLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase" },
    infoValue: { color: colors.accent, fontSize: 15, fontWeight: "600", marginTop: 4 },
    infoHint: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 12 },
    empty: { color: colors.textMuted, fontSize: 12 },
    orderCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, marginBottom: 8,
    },
    orderTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
    orderMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    orderStatus: { fontSize: 11, fontWeight: "700" },
    orderDate: { color: colors.textMuted, fontSize: 11 },
  });
}