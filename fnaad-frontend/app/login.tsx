import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

export default function LoginScreen() {
  const router = useRouter();
  const { setLoggedIn, refreshUser } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setErrorMsg("");
    if (!email.trim() || !password) {
      setErrorMsg(t("formFixErrors"));
      return;
    }

    setLoading(true);
    try {
      await loginUser(email.trim().toLowerCase(), password);
      await refreshUser();
      setLoggedIn(true);
      router.push("/");
    } catch (err: any) {
      if (!err.response) {
        setErrorMsg(t("serverUnreachable") || "Cannot reach the server. Please check your internet connection.");
      } else {
        setErrorMsg(t("loginError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <View style={styles.form}>
        <Image
          source={require("../assets/logo-full-transparent.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>{t("loginTitle")}</Text>

        {errorMsg ? <Text style={styles.error} accessibilityLiveRegion="polite">{errorMsg}</Text> : null}

        <Text style={styles.label}>{t("emailField")}</Text>
        <TextInput
          style={styles.field}
          placeholder="name@example.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          accessibilityLabel={t("emailField")}
        />
        <Text style={styles.label}>{t("password")}</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordField}
            placeholder={t("password")}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            accessibilityLabel={t("password")}
          />
          <Pressable
            style={styles.passwordToggle}
            onPress={() => setShowPassword((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? t("hidePassword") : t("showPassword")}
          >
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable style={styles.btn} onPress={handleLogin} disabled={loading} accessibilityRole="button" accessibilityState={{ disabled: loading }}>
          <Text style={styles.btnText}>{loading ? "..." : t("loginBtn")}</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/forgot-password")}>
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/role-select")}
          accessibilityRole="button"
          accessibilityLabel={t("createAccountBtn")}
        >
          <Text style={styles.createAccountLink}>{t("createAccountBtn")}</Text>
        </Pressable>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(
  colors: ReturnType<typeof import("../context/ThemeContext").useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>
) {
  return StyleSheet.create({
    keyboardContainer: { flex: 1, backgroundColor: colors.background },
    container: { flexGrow: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24 },
    form: { width: "100%", maxWidth: layout.formWidth, alignSelf: "center" },
    logo: { width: 200, height: 200, alignSelf: "center", marginBottom: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: "600", marginBottom: 24, textAlign: "center" },
    error: { color: "#E7A0A0", fontSize: 12, lineHeight: 18, marginBottom: 14, textAlign: "center" },
    label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 7 },
    field: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text, marginBottom: 16, fontSize: 14, minHeight: 48 },
    passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 16, minHeight: 48 },
    passwordField: { flex: 1, color: colors.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 },
    passwordToggle: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    btn: { backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
    btnText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    forgotLink: { color: colors.accent, textAlign: "center", marginTop: 18, fontSize: 12, fontWeight: "600" },
    createAccountLink: { color: colors.textMuted, textAlign: "center", marginTop: 14, fontSize: 12, fontWeight: "600" },
  });
}
