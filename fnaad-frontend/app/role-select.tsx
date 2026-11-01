import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";

export default function RoleSelectScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout, fonts);

  const [selected, setSelected] = useState<"artist" | "customer">("artist");

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contentWrap}>
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <Image
            source={require("../assets/logo-full-transparent.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t("joinFnaadTitle") || "Join the FNAAD Community"}</Text>
          <Text style={styles.subtitle}>
            {t("joinFnaadSubtitle") || "Select how you would like to experience our African art marketplace"}
          </Text>
        </View>

        {/* Option 1: Artist / Artisan */}
        <Pressable
          style={[styles.roleCard, selected === "artist" && styles.roleCardActive]}
          onPress={() => setSelected("artist")}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === "artist" }}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, selected === "artist" && styles.iconWrapActive]}>
              <Ionicons
                name="color-palette-outline"
                size={26}
                color={selected === "artist" ? colors.accent : colors.textMuted}
              />
            </View>
            <View style={styles.cardTitleWrap}>
              <View style={styles.badgeRow}>
                <Text style={styles.cardTitle}>{t("artistRole")}</Text>
                <View style={styles.creatorBadge}>
                  <Text style={styles.creatorBadgeText}>CREATOR</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>{t("artistRoleDescription")}</Text>
            </View>
            <View style={[styles.radioCircle, selected === "artist" && styles.radioCircleActive]}>
              {selected === "artist" && <View style={styles.radioInner} />}
            </View>
          </View>

          <View style={styles.perksList}>
            <View style={styles.perkItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.perkText}>
                {t("artistPerk1") || "Create your verified personal art shop"}
              </Text>
            </View>
            <View style={styles.perkItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.perkText}>
                {t("artistPerk2") || "Direct client inquiries & Mobile Money payments"}
              </Text>
            </View>
            <View style={styles.perkItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.perkText}>
                {t("artistPerk3") || "Originality Passport & 24h Spotlight discovery"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Option 2: Art Collector / Customer */}
        <Pressable
          style={[styles.roleCard, selected === "customer" && styles.roleCardActive]}
          onPress={() => setSelected("customer")}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === "customer" }}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, selected === "customer" && styles.iconWrapActive]}>
              <Ionicons
                name="sparkles-outline"
                size={26}
                color={selected === "customer" ? colors.accent : colors.textMuted}
              />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{t("customerRole")}</Text>
              <Text style={styles.cardSub}>{t("customerRoleDescription")}</Text>
            </View>
            <View style={[styles.radioCircle, selected === "customer" && styles.radioCircleActive]}>
              {selected === "customer" && <View style={styles.radioInner} />}
            </View>
          </View>

          <View style={styles.perksList}>
            <View style={styles.perkItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.perkText}>
                {t("customerPerk1") || "Discover original works from authentic local artists"}
              </Text>
            </View>
            <View style={styles.perkItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.perkText}>
                {t("customerPerk2") || "Custom commission requests & live artist chat"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Action Button */}
        <Pressable
          style={styles.btn}
          onPress={() => router.push({ pathname: "/signup", params: { role: selected } })}
        >
          <Text style={styles.btnText}>{t("continue")}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.accentText} style={{ marginLeft: 6 }} />
        </Pressable>

        {/* Back to Login */}
        <Pressable onPress={() => router.push("/login")} style={styles.loginRow}>
          <Text style={styles.loginPrompt}>{t("alreadyHaveAccountPrompt") || "Already have an account?"} </Text>
          <Text style={styles.loginLink}>{t("loginBtn")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>,
  fonts: ReturnType<typeof useTheme>["fonts"]
) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 36,
    },
    contentWrap: {
      width: "100%",
      maxWidth: layout.formWidth || 480,
      alignSelf: "center",
    },
    brandHeader: {
      alignItems: "center",
      marginBottom: 28,
    },
    logo: {
      width: 140,
      height: 140,
      marginBottom: 12,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
      letterSpacing: 0.2,
      fontFamily: fonts?.display,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 18,
      paddingHorizontal: 12,
    },
    roleCard: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      backgroundColor: colors.surface,
      elevation: 1,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    roleCardActive: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      elevation: 3,
      shadowColor: colors.accent,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 14,
    },
    iconWrapActive: {
      borderColor: colors.accent,
      backgroundColor: colors.background,
    },
    cardTitleWrap: {
      flex: 1,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    creatorBadge: {
      backgroundColor: colors.accent,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    creatorBadgeText: {
      color: colors.accentText,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    cardSub: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 3,
      lineHeight: 16,
    },
    radioCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },
    radioCircleActive: {
      borderColor: colors.accent,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accent,
    },
    perksList: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 6,
    },
    perkItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    perkText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "500",
    },
    btn: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 15,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
      elevation: 2,
      shadowColor: colors.accent,
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    btnText: {
      color: colors.accentText,
      fontWeight: "700",
      fontSize: 15,
    },
    loginRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 22,
      paddingVertical: 6,
    },
    loginPrompt: {
      color: colors.textMuted,
      fontSize: 13,
    },
    loginLink: {
      color: colors.accent,
      fontWeight: "700",
      fontSize: 13,
    },
  });
}
