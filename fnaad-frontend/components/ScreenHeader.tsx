import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Image from "./MediaImage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";

export default function ScreenHeader({
  title,
  subtitle,
  avatarUrl,
  onTitlePress,
  rightElement,
  showProfileAction = false,
}: {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  onTitlePress?: () => void;
  rightElement?: React.ReactNode;
  showProfileAction?: boolean;
}) {
  const router = useRouter();
  const { loggedIn } = useAuth();
  const { colors } = useTheme();
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };
  const { topPadding } = useResponsiveLayout();

  const TitleBlock = (
    <View style={styles.titleBlock}>
      {avatarUrl !== undefined && (
        avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: colors.accent }]} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { borderColor: colors.accent, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 14 }}>
              {title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: topPadding }]}>
      <Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={{ color: colors.accent, fontSize: 20 }}>{"←"}</Text>
      </Pressable>

      {onTitlePress ? (
        <Pressable style={{ flex: 1 }} onPress={onTitlePress}>
          {TitleBlock}
        </Pressable>
      ) : (
        TitleBlock
      )}

      <View style={styles.rightSlot}>
        {rightElement ?? (showProfileAction && loggedIn ? (
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
          </Pressable>
        ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40 },
  titleBlock: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, marginRight: 10 },
  avatarPlaceholder: { justifyContent: "center", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 11, marginTop: 1 },
  rightSlot: { width: 40, alignItems: "flex-end" },
});
