import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import React from "react";
import { requestPasswordReset } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setErrorMsg("Enter a valid email address.");
      return;
    }

    setErrorMsg("");
    setLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      Alert.alert("Code sent", "If an account exists with this email, a reset code has been sent.", [
        { text: "OK", onPress: () => router.push({ pathname: "/reset-password", params: { email: normalizedEmail } }) },
      ]);
    } catch (err: any) {
      console.log("Request reset error:", err.response?.data || err.message);
      setErrorMsg("Unable to send the code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.form}>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          Enter the email linked to your account. We will send you a code to reset your password.
        </Text>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <TextInput
          style={styles.field}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable style={styles.btn} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "..." : "Send code"}</Text>
        </Pressable>

        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/login")}>
          <Text style={styles.backLink}>Back to login</Text>
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
    title: { color: colors.text, fontSize: 22, fontWeight: "600", marginBottom: 10, textAlign: "center" },
    subtitle: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginBottom: 24, lineHeight: 18 },
    error: { color: "#E7A0A0", fontSize: 11, marginBottom: 14, textAlign: "center" },
    field: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      color: colors.text,
      marginBottom: 12,
      fontSize: 13,
    },
    btn: { backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
    btnText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    backLink: { color: colors.accent, textAlign: "center", marginTop: 20, fontSize: 12, fontWeight: "600" },
  });
}
