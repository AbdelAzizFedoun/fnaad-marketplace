import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { createCommissionRequest } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import ScreenHeader from "../components/ScreenHeader";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { shadow, RADIUS } from "../components/shadow";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

const CATEGORIES = [
  { value: "painting", label: "Peinture" },
  { value: "drawing", label: "Dessin" },
  { value: "abstract", label: "Art abstrait" },
  { value: "sculpture", label: "Sculpture" },
  { value: "portrait", label: "Portrait" },
  { value: "home_design", label: "Home Design" },
  { value: "contemporary", label: "Contemporary Art" },
  { value: "calligraphy", label: "Calligraphy" },
  { value: "artisan_crafts", label: "Artisan Crafts" },
  { value: "hall_of_fame", label: "Hall of Fame" },
  { value: "other", label: "Autre" },
];

const REGIONS = [
  { value: "", label: "Peu importe" },
  { value: "adamaoua", label: "Adamaoua" },
  { value: "centre", label: "Centre" },
  { value: "est", label: "Est" },
  { value: "extreme_nord", label: "Far North" },
  { value: "littoral", label: "Littoral" },
  { value: "nord", label: "Nord" },
  { value: "nord_ouest", label: "Nord-Ouest" },
  { value: "ouest", label: "Ouest" },
  { value: "sud", label: "Sud" },
  { value: "sud_ouest", label: "Sud-Ouest" },
];

export default function RequestCommissionScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [budget, setBudget] = useState("");
  const [region, setRegion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert(t("genericErrorTitle"), t("genericError"));
      return;
    }
    setSubmitting(true);
    try {
      await createCommissionRequest({
        title: title.trim(),
        description: description.trim(),
        category,
        budget_xaf: budget ? parseInt(budget, 10) : undefined,
        region: region || undefined,
      });
      Alert.alert(t("sentTitle"), t("responseSentToClient"), [
        { text: "OK", onPress: () => router.push("/my-commissions") },
      ]);
    } catch (err: any) {
      console.log("Commission create error:", err.response?.data || err.message);
      Alert.alert(t("genericErrorTitle"), t("sendResponseError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("requestCommissionTitle")} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("titleLabel")}</Text>
          <TextInput
            style={styles.field}
            placeholder={t("requestTitlePlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("descriptionLabel")}</Text>
          <TextInput
            style={[styles.field, styles.textArea]}
            placeholder={t("requestDescriptionPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("categoryLabel")}</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                style={[styles.chip, category === c.value && styles.chipSelected]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.chipText, category === c.value && styles.chipTextSelected]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("approximateBudget")}</Text>
          <TextInput
            style={styles.field}
            placeholder={t("requestBudgetPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("preferredRegion")}</Text>
          <View style={styles.chipRow}>
            {REGIONS.map((r) => (
              <Pressable
                key={r.value}
                style={[styles.chip, region === r.value && styles.chipSelected]}
                onPress={() => setRegion(r.value)}
              >
                <Text style={[styles.chipText, region === r.value && styles.chipTextSelected]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color={colors.accentText} />
          ) : (
            <Text style={styles.submitBtnText}>{t("submitRequest")}</Text>
          )}
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
    fieldGroup: { marginBottom: 20 },
    label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 8 },
    field: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14,
      color: colors.text, fontSize: 14, backgroundColor: colors.surface,
    },
    textArea: { minHeight: 110, textAlignVertical: "top" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 20,
      paddingVertical: 9, paddingHorizontal: 15, backgroundColor: colors.surface,
    },
    chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textMuted, fontSize: 12 },
    chipTextSelected: { color: colors.accentText, fontWeight: "700" },
    submitBtn: {
      backgroundColor: colors.accent, borderRadius: 12, padding: 16,
      alignItems: "center", marginTop: 28, ...shadow(3),
    },
    submitBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  });
}
