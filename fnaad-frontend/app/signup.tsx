import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { registerUser } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";

const REGION_VALUES = [
  "centre",
  "littoral",
  "ouest",
  "adamaoua",
  "est",
  "extreme_nord",
  "nord",
  "nord_ouest",
  "sud",
  "sud_ouest",
];

const GENDER_VALUES = [
  "male",
  "female",
  "unspecified",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors, fonts } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout, fonts);
  const isArtist = role === "artist";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [gender, setGender] = useState<string>("unspecified");
  const [nationalId, setNationalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const usernameInvalid = submitted && !username.trim();
  const emailInvalid = submitted && !EMAIL_REGEX.test(email.trim());
  const phoneInvalid = submitted && !phone.trim();
  const passwordInvalid = submitted && password.length < 6;
  const nationalIdInvalid = submitted && isArtist && !/^\d{9,}$/.test(nationalId.trim());

  const handleSubmit = async () => {
    setErrorMsg("");
    setSubmitted(true);

    if (!username.trim() || !phone.trim()) {
      setErrorMsg(t("formFixErrors"));
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setErrorMsg(t("formFixErrors"));
      return;
    }

    if (password.length < 6) {
      setErrorMsg(t("formFixErrors"));
      return;
    }

    if (isArtist && !region) {
      setErrorMsg(t("regionRequired"));
      return;
    }

    if (isArtist && !/^\d{9,}$/.test(nationalId.trim())) {
      setErrorMsg(t("formFixErrors"));
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        password,
        role: isArtist ? "artist" : "customer",
        region: isArtist ? region! : undefined,
        gender,
        national_id_number: isArtist ? nationalId.trim() : undefined,
      });
      Alert.alert(
        t("accountCreatedTitle") || "Account Created!",
        t("accountCreatedMsg") || "Welcome to FNAAD! You can now log in to your account."
      );
      router.push("/login");
    } catch (err: any) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.toLowerCase().includes("network")) {
        setErrorMsg(t("serverUnreachable") || "You are offline. Please check your internet connection and try again.");
      } else {
        const data = err.response?.data;
        if (typeof data === "object" && data !== null) {
          const firstKey = Object.keys(data)[0];
          const val = data[firstKey];
          const message = Array.isArray(val) ? val.join(" ") : String(val);
          setErrorMsg(`${firstKey}: ${message}`);
        } else {
          setErrorMsg(err.message || t("signupError") || "Registration failed. Please check your connection.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title={isArtist ? t("signupArtistTitle") : t("signupCustomerTitle")} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Role Highlight Card */}
        <View style={styles.roleBanner}>
          <View style={styles.roleIconWrap}>
            <Ionicons
              name={isArtist ? "color-palette" : "sparkles"}
              size={22}
              color={colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleBannerTitle}>
              {isArtist
                ? (t("artistRole") || "Artist / Artisan Account")
                : (t("customerRole") || "Art Collector Account")}
            </Text>
            <Text style={styles.roleBannerSub}>
              {isArtist
                ? (t("artistRoleDescription") || "Sell original artworks directly to clients across Cameroon")
                : (t("customerRoleDescription") || "Browse, purchase and commission authentic African creations")}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/role-select")}
            style={styles.changeRoleBtn}
            hitSlop={8}
          >
            <Text style={styles.changeRoleText}>{t("change") || "Change"}</Text>
          </Pressable>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#E05252" style={{ marginRight: 6 }} />
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {errorMsg}
            </Text>
          </View>
        ) : null}

        {/* Username Input */}
        <Text style={styles.label}>{t("username")}</Text>
        <View style={[styles.inputRow, usernameInvalid && styles.inputRowError]}>
          <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.field}
            placeholder={isArtist ? "e.g. StudioAura" : "e.g. John Doe"}
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username-new"
            accessibilityLabel={t("username")}
          />
        </View>
        {usernameInvalid ? <Text style={styles.inlineError}>{t("requiredField")}</Text> : null}

        {/* Email Input */}
        <Text style={styles.label}>{t("emailField")}</Text>
        <View style={[styles.inputRow, emailInvalid && styles.inputRowError]}>
          <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.field}
            placeholder="artist@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            accessibilityLabel={t("emailField")}
          />
        </View>
        {emailInvalid ? (
          <Text style={styles.inlineError}>
            {email.trim() ? t("emailInvalid") : t("requiredField")}
          </Text>
        ) : null}

        {/* Mobile Money Phone Input */}
        <Text style={styles.label}>{t("phoneField")}</Text>
        <View style={[styles.inputRow, phoneInvalid && styles.inputRowError]}>
          <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.field}
            placeholder="6XXXXXXXX (Orange / MTN)"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            accessibilityLabel={t("phoneField")}
          />
        </View>
        {phoneInvalid ? <Text style={styles.inlineError}>{t("requiredField")}</Text> : null}

        {/* Password Input */}
        <Text style={styles.label}>{t("password")}</Text>
        <View style={[styles.inputRow, passwordInvalid && styles.inputRowError]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.field}
            placeholder={t("password")}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            accessibilityLabel={t("password")}
          />
          <Pressable
            style={styles.passwordToggle}
            onPress={() => setShowPassword((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? t("hidePassword") : t("showPassword")}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
        {passwordInvalid ? (
          <Text style={styles.inlineError}>
            {password ? t("passwordMinimum") : t("requiredField")}
          </Text>
        ) : null}

        {/* Artist Specific: National ID Number */}
        {isArtist && (
          <>
            <View style={styles.labelWithBadge}>
              <Text style={styles.label}>{t("nationalIdLabel")}</Text>
              <View style={styles.securityBadge}>
                <Ionicons name="shield-checkmark-outline" size={12} color={colors.accent} />
                <Text style={styles.securityBadgeText}>Verified Trust</Text>
              </View>
            </View>
            <View style={[styles.inputRow, nationalIdInvalid && styles.inputRowError]}>
              <Ionicons name="card-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.field}
                placeholder="CNI (e.g. 100234567)"
                placeholderTextColor={colors.textMuted}
                value={nationalId}
                onChangeText={setNationalId}
                keyboardType="number-pad"
                maxLength={20}
                accessibilityLabel={t("nationalIdLabel")}
              />
            </View>
            {nationalIdInvalid ? (
              <Text style={styles.inlineError}>{t("nationalIdInvalid")}</Text>
            ) : null}
          </>
        )}

        {/* Artist Specific: Region Picker */}
        {isArtist && (
          <>
            <Text style={styles.sectionLabel}>{t("regionLabel")}</Text>
            <Text style={styles.sectionHint}>
              Select the region where your workshop/studio is located:
            </Text>
            <View style={styles.chipsWrap}>
              {REGION_VALUES.map((val) => {
                const isSelected = region === val;
                return (
                  <Pressable
                    key={val}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setRegion(val)}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={colors.accentText}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {t(`region_${val}`) || val}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Gender Selection */}
        <Text style={styles.sectionLabel}>{t("genderLabel")}</Text>
        <View style={styles.chipsWrap}>
          {GENDER_VALUES.map((val) => {
            const isSelected = gender === val;
            return (
              <Pressable
                key={val}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setGender(val)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {t(`gender_${val}`) || val}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Submit Button */}
        <Pressable
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          <Text style={styles.btnText}>
            {loading ? "..." : t("createAccountBtn")}
          </Text>
          {!loading && (
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.accentText}
              style={{ marginLeft: 6 }}
            />
          )}
        </Pressable>

        {/* Already have an account */}
        <Pressable onPress={() => router.push("/login")} style={styles.loginRow}>
          <Text style={styles.loginPrompt}>
            {t("alreadyHaveAccountPrompt") || "Already have an account?"}{" "}
          </Text>
          <Text style={styles.loginLink}>{t("loginBtn")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>,
  fonts: ReturnType<typeof useTheme>["fonts"]
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      width: "100%",
      maxWidth: layout.formWidth || 480,
      alignSelf: "center",
      padding: layout.horizontalPadding,
      paddingTop: 16,
      paddingBottom: 48,
    },
    roleBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    roleIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    roleBannerTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    roleBannerSub: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
      lineHeight: 15,
    },
    changeRoleBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    changeRoleText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(224, 82, 82, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(224, 82, 82, 0.3)",
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      flex: 1,
      color: "#E05252",
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "600",
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 7,
      marginTop: 4,
    },
    labelWithBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
      marginBottom: 7,
    },
    securityBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    securityBadgeText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "600",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginBottom: 6,
      minHeight: 50,
      paddingHorizontal: 12,
    },
    inputRowError: {
      borderColor: "#E05252",
    },
    inputIcon: {
      marginRight: 10,
    },
    field: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      paddingVertical: 12,
    },
    passwordToggle: {
      padding: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    inlineError: {
      color: "#E05252",
      fontSize: 12,
      lineHeight: 16,
      marginBottom: 8,
      marginLeft: 4,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 14,
      marginBottom: 4,
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 10,
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    chipTextSelected: {
      color: colors.accentText,
      fontWeight: "700",
    },
    btn: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 15,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
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
      marginTop: 20,
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
