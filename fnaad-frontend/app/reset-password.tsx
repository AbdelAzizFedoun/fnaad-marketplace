import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import React from "react";
import { confirmPasswordReset, requestPasswordReset } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";

const CODE_REGEX = /^\d{6}$/;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);

  const [email, setEmail] = useState(params.email || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const normalizedEmail = email.trim().toLowerCase();

  const validateForm = () => {
    if (!normalizedEmail) return "Enter your email address.";
    if (!CODE_REGEX.test(code.trim())) return "Enter the 6-digit code sent to your email.";
    if (newPassword.length < 6) return "New password must be at least 6 characters.";
    if (newPassword !== confirmPassword) return "Passwords do not match.";
    return "";
  };

  const handleReset = async () => {
    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setErrorMsg("");
    setLoading(true);
    try {
      await confirmPasswordReset(normalizedEmail, code.trim(), newPassword);
      Alert.alert("Password reset", "Your password has been changed. You can now log in.", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    } catch (err: any) {
      console.log("Confirm reset error:", err.response?.data || err.message);
      setErrorMsg(getResetErrorMessage(err.response?.data));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!normalizedEmail) {
      setErrorMsg("Enter your email address first.");
      return;
    }

    setErrorMsg("");
    setResending(true);
    try {
      await requestPasswordReset(normalizedEmail);
      Alert.alert("Code sent", "If this email exists, a new reset code has been sent.");
    } catch (err: any) {
      console.log("Resend reset error:", err.response?.data || err.message);
      setErrorMsg("Unable to send a new code. Try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.form}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Enter the code sent to your email, then choose a new password.</Text>

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

        <TextInput
          style={styles.field}
          placeholder="6-digit code"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <TextInput
          style={styles.field}
          placeholder="New password"
          placeholderTextColor={colors.textMuted}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.field}
          placeholder="Confirm new password"
          placeholderTextColor={colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <Pressable style={styles.btn} onPress={handleReset} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "..." : "Reset password"}</Text>
        </Pressable>

        <Pressable onPress={handleResendCode} disabled={resending}>
          <Text style={styles.link}>{resending ? "Sending..." : "Send a new code"}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/login")}>
          <Text style={styles.backLink}>Back to login</Text>
        </Pressable>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getResetErrorMessage(data: any) {
  if (data?.code) return Array.isArray(data.code) ? data.code[0] : data.code;
  if (data?.email) return Array.isArray(data.email) ? data.email[0] : data.email;
  if (data?.new_password) return Array.isArray(data.new_password) ? data.new_password[0] : data.new_password;
  if (data?.non_field_errors?.length) return data.non_field_errors[0];
  return "Unable to reset password. Check the code and try again.";
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
    link: { color: colors.accent, textAlign: "center", marginTop: 18, fontSize: 12, fontWeight: "600" },
    backLink: { color: colors.textMuted, textAlign: "center", marginTop: 14, fontSize: 12 },
  });
}
