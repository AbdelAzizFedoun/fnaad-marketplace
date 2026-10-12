import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import ScreenHeader from "../components/ScreenHeader";

export default function TermsScreen() {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("termsPageTitle")} />
      <ScrollView contentContainerStyle={styles.content}>

      <Text style={styles.sectionTitle}>{t("termsSec1Title")}</Text>
      <Text style={styles.paragraph}>{t("termsSec1Body")}</Text>

      <Text style={styles.sectionTitle}>{t("termsSec2Title")}</Text>
      <Text style={styles.paragraph}>{t("termsSec2Body")}</Text>

      <Text style={styles.sectionTitle}>{t("termsSec3Title")}</Text>
      <Text style={styles.paragraph}>{t("termsSec3Body")}</Text>

      <Text style={styles.sectionTitle}>{t("termsSec4Title")}</Text>
      <Text style={styles.paragraph}>{t("termsSec4Body")}</Text>

      <Text style={styles.sectionTitle}>{t("termsSec5Title")}</Text>
      <Text style={styles.paragraph}>{t("termsSec5Body")}</Text>

      <Text style={styles.sectionTitle}>{t("termsSec6Title")}</Text>
      <Text style={styles.paragraph}>{t("termsSec6Body")}</Text>

      <Text style={styles.sectionTitle}>{t("termsSec7Title")}</Text>
      <Text style={styles.paragraph}>{t("termsSec7Body")}</Text>

      <Text style={styles.footer}>{t("termsFooter")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0A0C" },
  content: { padding: 24, paddingBottom: 60 },
  sectionTitle: { color: "#F0ECE4", fontSize: 14, fontWeight: "700", marginTop: 18, marginBottom: 6 },
  paragraph: { color: "#B7B2B8", fontSize: 13, lineHeight: 19 },
  footer: { color: "#7D7880", fontSize: 10, textAlign: "center", marginTop: 30 },
});
