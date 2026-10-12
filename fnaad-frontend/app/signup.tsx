import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { registerUser } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

const REGION_VALUES = [
  "adamaoua",
  "centre",
  "est",
  "extreme_nord",
  "littoral",
  "nord",
  "nord_ouest",
  "ouest",
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
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);
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
        username,
        email: email.trim(),
        phone_number: phone,
        password,
        role: isArtist ? "artist" : "customer",
        region: isArtist ? region! : undefined,
        gender,
        national_id_number: isArtist ? nationalId.trim() : undefined,
      });
      Alert.alert(t("accountCreatedTitle"), t("accountCreatedMsg"));
      router.push("/");
    } catch (err: any) {
      setErrorMsg(JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={isArtist ? t("signupArtistTitle") : t("signupCustomerTitle")} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>

      {errorMsg ? <Text style={styles.error} accessibilityLiveRegion="polite">{errorMsg}</Text> : null}

      <Text style={styles.label}>{t("username")}</Text>
      <TextInput
        style={[styles.field, usernameInvalid && styles.fieldError]}
        placeholder={t("username")}
        placeholderTextColor={colors.textMuted}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username-new"
        accessibilityLabel={t("username")}
      />
      {usernameInvalid ? <Text style={styles.inlineError}>{t("requiredField")}</Text> : null}
      <Text style={styles.label}>{t("emailField")}</Text>
      <TextInput
        style={[styles.field, emailInvalid && styles.fieldError]}
        placeholder={t("emailField")}
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        accessibilityLabel={t("emailField")}
      />
      {emailInvalid ? <Text style={styles.inlineError}>{email.trim() ? t("emailInvalid") : t("requiredField")}</Text> : null}
      <Text style={styles.label}>{t("phoneField")}</Text>
      <TextInput
        style={[styles.field, phoneInvalid && styles.fieldError]}
        placeholder={t("phoneField")}
        placeholderTextColor={colors.textMuted}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        accessibilityLabel={t("phoneField")}
      />
      {phoneInvalid ? <Text style={styles.inlineError}>{t("requiredField")}</Text> : null}
      <Text style={styles.label}>{t("password")}</Text>
      <View style={[styles.passwordRow, passwordInvalid && styles.fieldError]}>
        <TextInput
          style={styles.passwordField}
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
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={colors.textMuted} />
        </Pressable>
      </View>
      {passwordInvalid ? <Text style={styles.inlineError}>{password ? t("passwordMinimum") : t("requiredField")}</Text> : null}

      {isArtist && (
        <>
          <Text style={styles.label}>{t("nationalIdLabel")}</Text>
          <TextInput
            style={[styles.field, nationalIdInvalid && styles.fieldError]}
            placeholder={t("nationalIdLabel")}
            placeholderTextColor={colors.textMuted}
            value={nationalId}
            onChangeText={setNationalId}
            keyboardType="number-pad"
            maxLength={20}
            accessibilityLabel={t("nationalIdLabel")}
          />
          {nationalIdInvalid ? <Text style={styles.inlineError}>{t("nationalIdInvalid")}</Text> : null}
        </>
      )}

      {isArtist && (
        <>
          <Text style={styles.sectionLabel}>{t("regionLabel")}</Text>
          <View style={styles.chipsWrap}>
        {REGION_VALUES.map((val) => (
              <Pressable
            key={val}
            style={[styles.chip, region === val && styles.chipSelected]}
            onPress={() => setRegion(val)}
              >
            <Text style={[styles.chipText, region === val && styles.chipTextSelected]}>
              {t(`region_${val}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>{t("genderLabel")}</Text>
      <View style={styles.chipsWrap}>
        {GENDER_VALUES.map((val) => (
          <Pressable
        key={val}
        style={[styles.chip, gender === val && styles.chipSelected]}
        onPress={() => setGender(val)}
          >
        <Text style={[styles.chipText, gender === val && styles.chipTextSelected]}>
          {t(`gender_${val}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.btn} onPress={handleSubmit} disabled={loading} accessibilityRole="button" accessibilityState={{ disabled: loading }}>
        <Text style={styles.btnText}>{loading ? "..." : t("createAccountBtn")}</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>
) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: layout.formWidth,
      alignSelf: "center",
      padding: layout.horizontalPadding,
      paddingBottom: 40,
    },
    error: { color: "#E7A0A0", fontSize: 12, lineHeight: 18, marginBottom: 14, textAlign: "center" },
    label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 7 },
    field: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text, marginBottom: 6, fontSize: 14, minHeight: 48 },
    fieldError: { borderColor: "#E05252" },
    inlineError: { color: "#E7A0A0", fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 10 },
    passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 6, minHeight: 48 },
    passwordField: { flex: 1, color: colors.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 },
    passwordToggle: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    sectionLabel: { color: colors.textMuted, fontSize: 12, marginTop: 8, marginBottom: 10 },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    chip: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 20,
      paddingVertical: 8, paddingHorizontal: 14,
    },
    chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textMuted, fontSize: 12 },
    chipTextSelected: { color: colors.accentText, fontWeight: "700" },
    btn: { backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
    btnText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
  });
}
