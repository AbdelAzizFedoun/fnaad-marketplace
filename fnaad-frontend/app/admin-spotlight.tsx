import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import React from "react";
import ScreenHeader from "../components/ScreenHeader";
import { approveAdminSpotlight, getAdminSpotlightFeatures } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

type SpotlightFeature = { id: number; product_title: string; artist_name: string; admin_approved: boolean };

export default function AdminSpotlightScreen() {
  const { t } = useLanguage(); const { colors } = useTheme(); const styles = createStyles(colors);
  const [items, setItems] = useState<SpotlightFeature[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [approving, setApproving] = useState<number | null>(null);
  const load = () => { setLoading(true); getAdminSpotlightFeatures().then((res) => setItems(res.data || [])).catch(() => setError(t("dashboardLoadError"))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const approve = async (id: number) => { setApproving(id); try { await approveAdminSpotlight(id); setItems((current) => current.filter((item) => item.id !== id)); } catch { setError(t("approveError")); } finally { setApproving(null); } };
  return <View style={styles.container}><ScreenHeader title={t("spotlightApproval")} />{loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : <FlatList data={items} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.content} ListHeaderComponent={<Text style={styles.description}>{t("spotlightApprovalDescription")}</Text>} ListEmptyComponent={<Text style={styles.empty}>{error || t("noSpotlightRequests")}</Text>} renderItem={({ item }) => <View style={styles.card}><Text style={styles.title}>{item.product_title}</Text><Text style={styles.artist}>{item.artist_name}</Text><Pressable style={styles.button} disabled={approving === item.id || item.admin_approved} onPress={() => approve(item.id)}><Text style={styles.buttonText}>{approving === item.id ? "..." : t("approveSpotlight")}</Text></Pressable></View>} />}</View>;
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) { return StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 12 }, description: { color: colors.textMuted, fontSize: 13, marginBottom: 8 }, empty: { color: colors.textMuted, textAlign: "center", marginTop: 30 }, card: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, backgroundColor: colors.surface }, title: { color: colors.text, fontSize: 15, fontWeight: "700" }, artist: { color: colors.textMuted, marginTop: 4, marginBottom: 12 }, button: { backgroundColor: colors.accent, borderRadius: 8, padding: 11, alignItems: "center" }, buttonText: { color: colors.accentText, fontWeight: "700" } }); }
