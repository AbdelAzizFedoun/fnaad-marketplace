import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES, LanguageCode } from "../i18n/translations";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import React from "react";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const styles = createStyles(colors);
  const selectedLanguage = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  const filteredLanguages = LANGUAGES.filter((l) =>
    l.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Pressable
        style={styles.button}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t("chooseLanguage")}: ${selectedLanguage.label}`}
      >
        <Text style={styles.flag}>{selectedLanguage.flag}</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboardContainer} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close language selector">
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t("chooseLanguage")}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t("searchLanguage")}
              placeholderTextColor="#9C979E"
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={filteredLanguages}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.languageRow, language === item.code && styles.languageRowSelected]}
                  onPress={() => {
                    setLanguage(item.code as LanguageCode);
                    setModalVisible(false);
                    setSearch("");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: language === item.code }}
                >
                  <Text style={styles.languageFlag}>{item.flag}</Text>
                  <Text style={styles.languageLabel}>{item.label}</Text>
                  {language === item.code && <Ionicons name="checkmark" size={18} color="#5FA779" />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    modalKeyboardContainer: { flex: 1 },
    button: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
      justifyContent: "center", alignItems: "center", backgroundColor: colors.surface,
    },
    flag: { fontSize: 18 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
    modalBox: { backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20, maxHeight: "70%" },
    modalTitle: { color: colors.accent, fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 12 },
    searchInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10,
      color: colors.text, fontSize: 13, marginBottom: 12,
    },
    languageRow: {
      flexDirection: "row", alignItems: "center", padding: 12,
      borderRadius: 8, marginBottom: 6,
    },
    languageRowSelected: { backgroundColor: colors.surface },
    languageFlag: { fontSize: 20, marginRight: 10 },
    languageLabel: { color: colors.text, fontSize: 14, flex: 1 },
    checkmark: { color: "#5FA779", fontSize: 16, fontWeight: "700" },
  },
  );
}
