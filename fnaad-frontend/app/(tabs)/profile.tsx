import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Image from "../../components/MediaImage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { resolveMediaUrl } from "../../services/api";

function MenuRow({
  icon,
  label,
  onPress,
  colors,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  colors: any;
  danger?: boolean;
}) {
  return (
    <Pressable style={[styles.row, { borderColor: colors.border }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? "#B0524F" : colors.accent} style={{ marginRight: 12 }} />
      <Text style={[styles.rowLabel, { color: danger ? "#B0524F" : colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileHubScreen() {
  const router = useRouter();
  const { user, loggedIn, logout } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const responsiveStyles = createResponsiveStyles(layout);

  if (!loggedIn) {
    return (
      <View style={[styles.loginGate, { backgroundColor: colors.background }]}>
        <Text style={[styles.loginGateText, { color: colors.text }]}>
          {t("loginToAccessProfile")}
        </Text>
        <Pressable
          style={[styles.loginButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/login")}
        >
          <Text style={[styles.loginButtonText, { color: colors.accentText }]}>{t("loginBtn")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={responsiveStyles.content}
    >
      <View style={[styles.profileCard, { borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          {user?.profile_photo ? <Image source={{ uri: resolveMediaUrl(user.profile_photo)! }} style={styles.avatarImage} /> : <Text style={{ color: colors.accentText, fontSize: 24, fontWeight: "800" }}>{(user?.username || "U").slice(0, 1).toUpperCase()}</Text>}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{user?.username}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 3 }}>{user?.email}</Text>
        <Text style={[styles.roleBadge, { color: colors.accent, borderColor: colors.accent }]}>{user?.is_artist ? (t("artist") || "ARTIST") : (t("customer") || "CUSTOMER")}</Text>
      </View>

      <MenuRow icon="settings-outline" label={t("settingsTitle")} onPress={() => router.push("/settings")} colors={colors} />
      <MenuRow icon="bag-handle-outline" label={t("myOrders")} onPress={() => router.push("/my-orders")} colors={colors} />
      <MenuRow icon="heart-outline" label={t("savedArtworks")} onPress={() => router.push("/(tabs)/favorites")} colors={colors} />
      <MenuRow icon="color-palette-outline" label={t("myArtworkRequests")} onPress={() => router.push("/my-commissions")} colors={colors} />
      {user?.is_artist && <>
        <MenuRow icon="brush-outline" label={t("editArtistProfile")} onPress={() => router.push("/edit-artist-profile")} colors={colors} />
        <MenuRow icon="images-outline" label={t("myArtworks")} onPress={() => router.push("/my-products")} colors={colors} />
      </>}

      {user?.is_staff && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("administration").toUpperCase()}</Text>
          <MenuRow icon="bar-chart-outline" label={t("dashboardTitle")} onPress={() => router.push("/admin-dashboard")} colors={colors} />
          <MenuRow icon="checkmark-circle-outline" label={t("moderation")} onPress={() => router.push("/admin-approve")} colors={colors} />
          <MenuRow icon="people-outline" label={t("artistsTitle")} onPress={() => router.push("/admin-artists")} colors={colors} />
          <MenuRow icon="card-outline" label={t("subscriptionsTitle") || "Subscriptions"} onPress={() => router.push("/admin-subscriptions")} colors={colors} />
          <MenuRow icon="warning-outline" label={t("reportsTitle")} onPress={() => router.push("/admin-reports")} colors={colors} />
        </>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("otherSection").toUpperCase()}</Text>
      <MenuRow icon="document-text-outline" label={t("terms")} onPress={() => router.push("/terms")} colors={colors} />
      <MenuRow icon="log-out-outline" label={t("logout")} onPress={() => void logout()} colors={colors} danger />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loginGate: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loginGateText: { fontSize: 16, marginBottom: 16, textAlign: "center" },
  loginButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  loginButtonText: { fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "700" },
  profileCard: { borderWidth: 1, borderRadius: 14, padding: 20, alignItems: "center", marginBottom: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  roleBadge: { marginTop: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: "700", marginTop: 20, marginBottom: 10, letterSpacing: 1 },
  row: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10,
    padding: 14, marginBottom: 10,
  },
  rowLabel: { fontSize: 14, fontWeight: "600", flex: 1 },
});

function createResponsiveStyles(layout: ReturnType<typeof useResponsiveLayout>) {
  return StyleSheet.create({
    content: {
      width: "100%",
      maxWidth: layout.formWidth,
      alignSelf: "center",
      paddingHorizontal: layout.horizontalPadding,
      paddingTop: layout.topPadding,
      paddingBottom: 40,
    },
  });
}
