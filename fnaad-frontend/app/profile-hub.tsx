import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type MenuItem = {
  icon: IoniconsName;
  labelKey: string;
  route: string;
};

const ACCOUNT_ITEMS: MenuItem[] = [
  { icon: "settings-outline", labelKey: "settings", route: "/settings" },
  { icon: "color-palette-outline", labelKey: "myArtworkRequests", route: "/my-commissions" },
];

const ADMIN_ITEMS: MenuItem[] = [
  { icon: "bar-chart-outline", labelKey: "dashboard", route: "/admin-dashboard" },
  { icon: "checkmark-circle-outline", labelKey: "moderation", route: "/admin-approve" },
  { icon: "people-outline", labelKey: "artists", route: "/admin-artists" },
  { icon: "warning-outline", labelKey: "reports", route: "/admin-reports" },
];

export default function ProfileHubScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { topPadding } = useResponsiveLayout();
  const styles = createStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 16, paddingBottom: 30 }}>
      <Text style={styles.title}>{t("profile") || "Profile"}</Text>

      {user && (
        <View style={styles.userCard}>
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.role}>
            {user.is_staff ? (t("administrator") || "Administrator") : user.is_artist ? (t("artist") || "Artist") : (t("customer") || "Customer")}
          </Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t("account") || "Account"}</Text>
      {ACCOUNT_ITEMS.map((item) => (
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

      {user?.is_staff && (
        <>
          <Text style={styles.sectionLabel}>{t("administration") || "Administration"}</Text>
          {ADMIN_ITEMS.map((item) => (
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
        </>
      )}

      <Text style={styles.sectionLabel}>{t("other") || "Other"}</Text>
      <Pressable style={styles.row} onPress={() => router.push("/terms")}>
        <Ionicons name="document-text-outline" size={20} color={colors.accent} style={{ marginRight: 12 }} />
        <Text style={styles.label}>{t("terms") || "Terms of use"}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable style={styles.logoutRow} onPress={() => void logout()}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="log-out-outline" size={18} color="#B0524F" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log out</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    title: { color: colors.accent, fontSize: 22, fontWeight: "700", marginBottom: 16, textAlign: "left" },
    userCard: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 14, marginBottom: 20,
    },
    username: { color: colors.text, fontSize: 16, fontWeight: "700" },
    role: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
    row: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 14, marginBottom: 10,
    },
    label: { color: colors.text, fontSize: 14, fontWeight: "500", flex: 1 },
    logoutRow: {
      marginTop: 20, padding: 14, alignItems: "center",
      borderWidth: 1, borderColor: "#B0524F", borderRadius: 10,
    },
    logoutText: { color: "#B0524F", fontWeight: "700", fontSize: 13 },
  });
}
