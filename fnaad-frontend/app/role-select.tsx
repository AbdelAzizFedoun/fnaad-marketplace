import { View, Text, Pressable, StyleSheet } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import React from "react";
import { useLanguage } from "../context/LanguageContext";

export default function RoleSelectScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [selected, setSelected] = useState<"artist" | "customer">("artist");

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/logo-full-transparent.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Pressable
        style={[styles.card, selected === "artist" && styles.cardActive]}
        onPress={() => setSelected("artist")}
      >
        <Text style={styles.cardTitle}>{t("artistRole")}</Text>
        <Text style={styles.cardSub}>{t("artistRoleDescription")}</Text>
      </Pressable>

      <Pressable
        style={[styles.card, selected === "customer" && styles.cardActive]}
        onPress={() => setSelected("customer")}
      >
        <Text style={styles.cardTitle}>{t("customerRole")}</Text>
        <Text style={styles.cardSub}>{t("customerRoleDescription")}</Text>
      </Pressable>

      <Pressable
        style={styles.btn}
        onPress={() => router.push({ pathname: "/signup", params: { role: selected } })}
      >
        <Text style={styles.btnText}>{t("continue")}</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/login")}>
        <Text style={styles.loginLink}>{t("alreadyAccount")}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24 },
    logo: { width: 180, height: 180, alignSelf: "center", marginBottom: 24 },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginBottom: 12 },
    cardActive: { borderColor: colors.accent },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
    cardSub: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    btn: { backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 12 },
    btnText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    loginLink: { color: colors.textMuted, textAlign: "center", marginTop: 16, fontSize: 12 },
  });
}
